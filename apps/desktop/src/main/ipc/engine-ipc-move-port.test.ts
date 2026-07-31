import {
  GATEWAY_CONFIG_VERSION,
  loadGatewayConfig,
  type EngineGateway,
  type GatewayConfig,
  type IpcError,
} from '@recompose/contracts';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { EngineHost } from '../engine-host/engine-host';
import type { EngineIpcContext } from './engine-ipc';

import { createEngineIpcHandlers } from './engine-ipc';

function gatewayNamed(slug: string, port: number): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug,
    displayName: slug,
    port,
    virtualModels: [],
    layout: { nodes: {} },
  };
}

function hostAnswering(refusal?: Error) {
  const restarted: EngineGateway[] = [];

  const host: EngineHost = {
    start: async () => Promise.resolve({ status: 'running' }),
    stop: async () => Promise.resolve({ status: 'stopped' }),
    restart: async (gateway) => {
      restarted.push(gateway);

      return refusal === undefined
        ? Promise.resolve({ status: 'running' })
        : Promise.reject(refusal);
    },
    states: () => ({}),
    onStatesChanged: () => () => undefined,
    dispose: () => undefined,
  };

  return { host, restarted };
}

async function freshContext(
  stored: readonly GatewayConfig[],
  host: EngineHost,
  probeFreePort: EngineIpcContext['probeFreePort'],
): Promise<EngineIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-move-port-'));
  const gatewaysDir = join(userDataPath, 'gateways');

  await mkdir(gatewaysDir, { recursive: true });

  for (const config of stored) {
    await writeFile(join(gatewaysDir, `${config.slug}.json`), JSON.stringify(config), 'utf8');
  }

  return {
    userDataPath,
    homeFolder: '/Users/ada',
    onCorrupt: () => undefined,
    host,
    probeFreePort,
  };
}

function offeringTheFirstFreeOf(ports: readonly number[]): EngineIpcContext['probeFreePort'] {
  return async (taken) => {
    const free = ports.find((port) => !taken.has(port));

    if (free === undefined) {
      throw new Error('every port on offer is already held');
    }

    return Promise.resolve(free);
  };
}

function refusalIn(answer: { ok: true } | { ok: false; error: IpcError }): IpcError {
  if (answer.ok) {
    throw new Error('the handler answered where the spec expected a refusal');
  }

  return answer.error;
}

async function storedGateway(userDataPath: string, slug: string): Promise<GatewayConfig> {
  const written: unknown = JSON.parse(
    await readFile(join(userDataPath, 'gateways', `${slug}.json`), 'utf8'),
  );

  return loadGatewayConfig(written);
}

describe('moving a gateway off a port another process took', () => {
  test('the stored document carries the new port and the answer carries the new list', async () => {
    const context = await freshContext(
      [gatewayNamed('codex', 8397)],
      hostAnswering().host,
      offeringTheFirstFreeOf([51234]),
    );

    const answer = await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(answer).toEqual({ ok: true, value: [gatewayNamed('codex', 51234)] });
    expect(await storedGateway(context.userDataPath, 'codex')).toEqual(
      gatewayNamed('codex', 51234),
    );
  });

  test('the gateway serves again on the port it moved to', async () => {
    const recorded = hostAnswering();
    const context = await freshContext(
      [gatewayNamed('codex', 8397)],
      recorded.host,
      offeringTheFirstFreeOf([51234]),
    );

    await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(recorded.restarted).toEqual([{ slug: 'codex', displayName: 'codex', port: 51234 }]);
  });

  test('the port being abandoned is the one port the move never lands back on', async () => {
    const context = await freshContext(
      [gatewayNamed('codex', 8397)],
      hostAnswering().host,
      offeringTheFirstFreeOf([8397, 51234]),
    );

    const answer = await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(answer).toEqual({ ok: true, value: [gatewayNamed('codex', 51234)] });
  });

  test('the move never lands on a port a sibling gateway holds', async () => {
    const context = await freshContext(
      [gatewayNamed('codex', 8397), gatewayNamed('gemini', 8398)],
      hostAnswering().host,
      offeringTheFirstFreeOf([8398, 51234]),
    );

    const answer = await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(answer).toEqual({
      ok: true,
      value: [gatewayNamed('codex', 51234), gatewayNamed('gemini', 8398)],
    });
  });
});

describe('a move the app cannot carry out', () => {
  test('a move naming a gateway nothing stored is refused with the slug in the message', async () => {
    const context = await freshContext([], hostAnswering().host, offeringTheFirstFreeOf([51234]));

    const answer = await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('codex');
  });

  test('the gateway moved is the one named, not whichever the directory lists first', async () => {
    const context = await freshContext(
      [gatewayNamed('codex', 8397), gatewayNamed('gemini', 8398)],
      hostAnswering().host,
      offeringTheFirstFreeOf([51234]),
    );

    await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'gemini' });

    expect(await storedGateway(context.userDataPath, 'codex')).toEqual(gatewayNamed('codex', 8397));
    expect(await storedGateway(context.userDataPath, 'gemini')).toEqual(
      gatewayNamed('gemini', 51234),
    );
  });

  test('an engine that refuses the restart reports it rather than claiming the move landed', async () => {
    const context = await freshContext(
      [gatewayNamed('codex', 8397)],
      hostAnswering(new Error('the engine did not report on the start')).host,
      offeringTheFirstFreeOf([51234]),
    );

    const answer = await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('the engine did not report');
  });

  test('a refused restart leaves the stored port where the gateway still answers', async () => {
    const context = await freshContext(
      [gatewayNamed('codex', 8397)],
      hostAnswering(new Error('the engine did not report on the start')).host,
      offeringTheFirstFreeOf([51234]),
    );

    await createEngineIpcHandlers(context)['gateways:move-port']({ slug: 'codex' });

    expect(await storedGateway(context.userDataPath, 'codex')).toEqual(gatewayNamed('codex', 8397));
  });
});

import {
  GATEWAY_CONFIG_VERSION,
  type EngineGateway,
  type EngineStates,
  type GatewayConfig,
  type GatewayEngineState,
  type IpcError,
} from '@recompose/contracts';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
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

function hostAnswering(
  state: GatewayEngineState = { status: 'running' },
  snapshot: EngineStates = {},
  refusal?: Error,
) {
  const started: EngineGateway[] = [];
  const stopped: string[] = [];
  const answer = async (): Promise<GatewayEngineState> =>
    refusal === undefined ? Promise.resolve(state) : Promise.reject(refusal);

  const host: EngineHost = {
    start: async (gateway) => {
      started.push(gateway);

      return answer();
    },
    stop: async (slug) => {
      stopped.push(slug);

      return answer();
    },
    restart: async () => answer(),
    states: () => snapshot,
    onStatesChanged: () => () => undefined,
    probe: async () => Promise.resolve({ verdict: 'could-not-check' as const }),
    probeRuntime: async () => Promise.resolve({ verdict: 'unreachable' as const }),
    listModels: async () => Promise.resolve({ standing: 'unlisted' as const }),
    dispose: () => undefined,
  };

  return { host, started, stopped };
}

async function freshContext(
  stored: readonly GatewayConfig[],
  host: EngineHost,
  probeFreePort: EngineIpcContext['probeFreePort'],
): Promise<EngineIpcContext> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-engine-ipc-'));
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

const codex: GatewayConfig = gatewayNamed('codex', 8397);

describe('offering the creation sheet a port', () => {
  test('the offer is a port the operating system says is free', async () => {
    const context = await freshContext([], hostAnswering().host, offeringTheFirstFreeOf([51234]));

    await expect(
      createEngineIpcHandlers(context)['gateways:offer-port'](undefined),
    ).resolves.toEqual({ ok: true, value: 51234 });
  });

  test('a port a stored gateway already holds is never offered', async () => {
    const context = await freshContext(
      [codex],
      hostAnswering().host,
      offeringTheFirstFreeOf([8397, 51234]),
    );

    await expect(
      createEngineIpcHandlers(context)['gateways:offer-port'](undefined),
    ).resolves.toEqual({ ok: true, value: 51234 });
  });

  test('a probe that cannot answer reports the failure rather than offering nothing', async () => {
    const context = await freshContext([], hostAnswering().host, async () =>
      Promise.reject(new Error('the loopback probe could not bind')),
    );

    const answer = await createEngineIpcHandlers(context)['gateways:offer-port'](undefined);

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('the loopback probe could not bind');
  });
});

describe('starting one gateway', () => {
  test('a started gateway answers the state the engine reported', async () => {
    const context = await freshContext(
      [codex],
      hostAnswering().host,
      offeringTheFirstFreeOf([51234]),
    );

    await expect(
      createEngineIpcHandlers(context)['engine:start']({ slug: 'codex' }),
    ).resolves.toEqual({ ok: true, value: { status: 'running' } });
  });

  test('the engine hears the name and the port the stored document carries', async () => {
    const recorded = hostAnswering();
    const context = await freshContext(
      [{ ...codex, displayName: 'Codex' }],
      recorded.host,
      offeringTheFirstFreeOf([51234]),
    );

    await createEngineIpcHandlers(context)['engine:start']({ slug: 'codex' });

    expect(recorded.started).toEqual([
      { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] },
    ]);
  });

  test('a failed start crosses as an answer carrying the port, not as a refusal', async () => {
    const context = await freshContext(
      [codex],
      hostAnswering({ status: 'stopped', failure: { port: 8397 } }).host,
      offeringTheFirstFreeOf([51234]),
    );

    await expect(
      createEngineIpcHandlers(context)['engine:start']({ slug: 'codex' }),
    ).resolves.toEqual({ ok: true, value: { status: 'stopped', failure: { port: 8397 } } });
  });
});

describe('reaching for a gateway that is not there', () => {
  test('a start naming a gateway nothing stored is refused with the slug in the message', async () => {
    const context = await freshContext([], hostAnswering().host, offeringTheFirstFreeOf([51234]));

    const answer = await createEngineIpcHandlers(context)['engine:start']({ slug: 'codex' });

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('codex');
  });

  test('an engine that never reports becomes a refusal naming the gateway', async () => {
    const silence = new Error('The engine did not report on the start of "codex".');
    const context = await freshContext(
      [codex],
      hostAnswering({ status: 'running' }, {}, silence).host,
      offeringTheFirstFreeOf([51234]),
    );

    const answer = await createEngineIpcHandlers(context)['engine:start']({ slug: 'codex' });

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('codex');
  });
});

describe('stopping one gateway', () => {
  test('a stopped gateway answers the state the engine reported', async () => {
    const recorded = hostAnswering({ status: 'stopped' });
    const context = await freshContext([codex], recorded.host, offeringTheFirstFreeOf([51234]));

    await expect(
      createEngineIpcHandlers(context)['engine:stop']({ slug: 'codex' }),
    ).resolves.toEqual({ ok: true, value: { status: 'stopped' } });
    expect(recorded.stopped).toEqual(['codex']);
  });

  test('a stop reaches the engine even for a gateway nothing stored, so no port outlives its file', async () => {
    const context = await freshContext(
      [],
      hostAnswering({ status: 'stopped' }).host,
      offeringTheFirstFreeOf([51234]),
    );

    await expect(
      createEngineIpcHandlers(context)['engine:stop']({ slug: 'codex' }),
    ).resolves.toEqual({ ok: true, value: { status: 'stopped' } });
  });

  test('an engine that never reports the stop becomes a refusal rather than a claim', async () => {
    const silence = new Error('The engine did not report on the stop of "codex".');
    const context = await freshContext(
      [codex],
      hostAnswering({ status: 'stopped' }, {}, silence).host,
      offeringTheFirstFreeOf([51234]),
    );

    const answer = await createEngineIpcHandlers(context)['engine:stop']({ slug: 'codex' });

    expect(refusalIn(answer).code).toBe('storage-failed');
    expect(refusalIn(answer).message).toContain('codex');
  });
});

describe('reading which gateways serve', () => {
  test('the first paint reads the ledger rather than waiting for a push', async () => {
    const snapshot: EngineStates = { codex: { status: 'running' }, gemini: { status: 'stopped' } };
    const context = await freshContext(
      [],
      hostAnswering({ status: 'running' }, snapshot).host,
      offeringTheFirstFreeOf([51234]),
    );

    await expect(createEngineIpcHandlers(context)['engine:states'](undefined)).resolves.toEqual({
      ok: true,
      value: snapshot,
    });
  });
});

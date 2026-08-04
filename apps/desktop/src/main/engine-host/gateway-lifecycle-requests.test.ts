import {
  GATEWAY_CONFIG_VERSION,
  type EngineGateway,
  type GatewayConfig,
} from '@recompose/contracts';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { EngineHost } from './engine-host';

import { createGatewayLifecycleRequests } from './gateway-lifecycle-requests';

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

function recordingHost() {
  const started: EngineGateway[] = [];
  const stopped: string[] = [];
  const restarted: EngineGateway[] = [];

  const host: EngineHost = {
    start: async (gateway) => {
      started.push(gateway);

      return Promise.resolve({ status: 'running' });
    },
    stop: async (slug) => {
      stopped.push(slug);

      return Promise.resolve({ status: 'stopped' });
    },
    restart: async (gateway) => {
      restarted.push(gateway);

      return Promise.resolve({ status: 'running' });
    },
    states: () => ({}),
    onStatesChanged: () => () => undefined,
    probe: async () => Promise.resolve({ verdict: 'could-not-check' as const }),
    probeRuntime: async () => Promise.resolve({ verdict: 'unreachable' as const }),
    dispose: () => undefined,
  };

  return { host, started, stopped, restarted };
}

async function directoryHolding(stored: readonly GatewayConfig[]): Promise<string> {
  const gatewaysDir = join(await mkdtemp(join(tmpdir(), 'recompose-lifecycle-')), 'gateways');

  await mkdir(gatewaysDir, { recursive: true });

  for (const config of stored) {
    await writeFile(join(gatewaysDir, `${config.slug}.json`), JSON.stringify(config), 'utf8');
  }

  return gatewaysDir;
}

function complained(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.flat().map(String).join(' ');
}

function requestsOver(host: EngineHost | null, gatewaysDir: string) {
  return createGatewayLifecycleRequests({
    host: () => host,
    gatewaysDir: () => gatewaysDir,
    onCorrupt: () => undefined,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('asking the engine to act on a gateway named only by its slug', () => {
  test('starting looks the gateway up and hands the engine its name and port', async () => {
    const recorded = recordingHost();
    const requests = requestsOver(
      recorded.host,
      await directoryHolding([gatewayNamed('codex', 8397)]),
    );

    requests.start('codex');

    await vi.waitFor(() => {
      expect(recorded.started).toEqual([{ slug: 'codex', displayName: 'codex', port: 8397 }]);
    });
  });

  test('stopping needs no document, because a slug is all a listener is filed under', async () => {
    const recorded = recordingHost();
    const requests = requestsOver(recorded.host, await directoryHolding([]));

    requests.stop('codex');

    await vi.waitFor(() => {
      expect(recorded.stopped).toEqual(['codex']);
    });
  });

  test('restarting hands the engine the gateway it looked up', async () => {
    const recorded = recordingHost();
    const requests = requestsOver(
      recorded.host,
      await directoryHolding([gatewayNamed('codex', 8397)]),
    );

    requests.restart('codex');

    await vi.waitFor(() => {
      expect(recorded.restarted).toEqual([{ slug: 'codex', displayName: 'codex', port: 8397 }]);
    });
  });

  test('one request never reaches a gateway it did not name', async () => {
    const recorded = recordingHost();
    const requests = requestsOver(
      recorded.host,
      await directoryHolding([gatewayNamed('codex', 8397), gatewayNamed('gemini', 8398)]),
    );

    requests.start('gemini');

    await vi.waitFor(() => {
      expect(recorded.started).toEqual([{ slug: 'gemini', displayName: 'gemini', port: 8398 }]);
    });
  });
});

describe('a request the engine cannot answer', () => {
  test('a slug nothing stored names the gateway and the act it refused', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recorded = recordingHost();
    const requests = requestsOver(recorded.host, await directoryHolding([]));

    requests.start('codex');

    await vi.waitFor(() => {
      expect(complained(complaint)).toContain('start the gateway "codex"');
    });
    expect(complained(complaint)).toContain('stores no gateway');
    expect(recorded.started).toEqual([]);
  });

  test('a request before the engine exists says so, and reaches no engine at all', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recorded = recordingHost();
    const requests = createGatewayLifecycleRequests({
      host: () => null,
      gatewaysDir: () => tmpdir(),
      onCorrupt: () => undefined,
    });

    requests.stop('codex');

    await vi.waitFor(() => {
      expect(complained(complaint)).toContain('before the engine was ready');
    });
    expect(complained(complaint)).toContain('stop the gateway "codex"');
    expect(recorded.stopped).toEqual([]);
  });
});

describe('an engine that refuses a directive', () => {
  test('the refusal names the act beside the reason', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const refusing: EngineHost = {
      ...recordingHost().host,
      stop: async () => Promise.reject(new Error('the engine did not report')),
    };
    const requests = requestsOver(refusing, await directoryHolding([]));

    requests.stop('codex');

    await vi.waitFor(() => {
      expect(complained(complaint)).toContain('the engine did not report');
    });
    expect(complained(complaint)).toContain('stop the gateway "codex"');
  });

  test('a restart the engine refuses names the restart, not some other act', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const refusing: EngineHost = {
      ...recordingHost().host,
      restart: async () => Promise.reject(new Error('the engine did not report')),
    };
    const requests = requestsOver(refusing, await directoryHolding([gatewayNamed('codex', 8397)]));

    requests.restart('codex');

    await vi.waitFor(() => {
      expect(complained(complaint)).toContain('restart the gateway "codex"');
    });
  });
});

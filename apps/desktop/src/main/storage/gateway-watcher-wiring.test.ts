import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveGatewayConfig } from './gateway-store';
import { startGatewayWatcher } from './gateway-watcher-wiring';
import {
  EVENT_DRIVEN_TIMEOUT,
  gatewayDocument,
  untilNoticed,
  untilSettled,
} from './watcher-wiring.testkit';

const temporaryDirectories: string[] = [];
const openWatchers: { close: () => void }[] = [];

afterEach(async () => {
  for (const watcher of openWatchers.splice(0)) watcher.close();

  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe('the gateways folder as recompose watches it', () => {
  it(
    'restarts the gateway whose document lands in the folder',
    async () => {
      const folder = await watchedGateways();

      await untilNoticed(
        async () => saveGatewayConfig(folder.gatewaysPath, gatewayDocument('codex', 'Codex')),
        () => {
          expect(folder.restarts).toEqual(['codex']);
        },
      );

      expect(folder.stops).toEqual([]);
    },
    EVENT_DRIVEN_TIMEOUT,
  );

  it(
    'stops the gateway whose document leaves the folder',
    async () => {
      const folder = await watchedGateways();

      await untilNoticed(
        async () => saveGatewayConfig(folder.gatewaysPath, gatewayDocument('codex', 'Codex')),
        () => {
          expect(folder.restarts).toEqual(['codex']);
        },
      );
      await rm(join(folder.gatewaysPath, 'codex.json'));
      await untilSettled(() => {
        expect(folder.stops).toEqual(['codex']);
      });
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

describe('a gateway document recompose is too old to read', () => {
  it(
    'is written down rather than swallowed',
    async () => {
      const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const folder = await watchedGateways();
      const unreadable = join(folder.gatewaysPath, 'codex.json');

      await untilNoticed(
        async () => writeFile(unreadable, fromANewerBuild(), 'utf8'),
        () => {
          expect(complaint).toHaveBeenCalled();
        },
      );

      expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('gateways');
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

// Helpers

async function watchedGateways() {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-gateway-wiring-'));
  const restarts: string[] = [];
  const stops: string[] = [];

  temporaryDirectories.push(userDataPath);
  const watcher = await startGatewayWatcher({
    userDataPath,
    lifecycle: {
      restart: (slug) => {
        restarts.push(slug);
      },
      stop: (slug) => {
        stops.push(slug);
      },
    },
    onCorrupt: () => undefined,
  });

  openWatchers.push(watcher);

  return { gatewaysPath: join(userDataPath, 'gateways'), restarts, stops };
}

function fromANewerBuild(): string {
  return JSON.stringify({ schemaVersion: GATEWAY_CONFIG_VERSION + 1, slug: 'codex' });
}

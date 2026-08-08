import { type GatewayConfig } from '@recompose/contracts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveGatewayConfig } from './gateway-store';
import { startStorageWatchers } from './storage-watchers';
import {
  accountsDocument,
  EVENT_DRIVEN_TIMEOUT,
  gatewayDocument,
  longEnoughForAReaction,
  untilNoticed,
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

describe('what one folder of stored state tells recompose', () => {
  it(
    'restarts the gateway whose document lands in the gateways folder',
    async () => {
      const watched = await startedWatchers();

      await untilNoticed(
        async () => saveGatewayConfig(watched.gatewaysPath, gatewayDocument('codex', 'Codex')),
        () => {
          expect(watched.restarts).toEqual(['codex']);
        },
      );

      expect(watched.notices).toEqual([]);
    },
    EVENT_DRIVEN_TIMEOUT,
  );

  it(
    'reports the accounts changing beside that folder',
    async () => {
      const watched = await startedWatchers();

      await untilNoticed(
        async () => writeFile(watched.accountsPath, accountsDocument('work'), 'utf8'),
        () => {
          expect(watched.notices).toEqual(['accounts changed']);
        },
      );

      expect(watched.restarts).toEqual([]);
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

describe('a gateway write recompose served itself', () => {
  it(
    'restarts only the gateway recompose did not write',
    async () => {
      const watched = await startedWatchers();
      const served = gatewayDocument('codex', 'Codex');

      watched.watchers.noteGatewayWrite(served);
      await untilNoticed(
        async () => storeBoth(watched.gatewaysPath, served),
        () => {
          expect(watched.restarts).toEqual(['claude']);
        },
      );
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

describe('storage watchers that have been closed', () => {
  it(
    'leave later changes on disk unanswered',
    async () => {
      const watched = await startedWatchers();

      await untilNoticed(
        async () => saveGatewayConfig(watched.gatewaysPath, gatewayDocument('codex', 'Codex')),
        () => {
          expect(watched.restarts).toEqual(['codex']);
        },
      );
      watched.watchers.close();

      await saveGatewayConfig(watched.gatewaysPath, gatewayDocument('claude', 'Claude'));
      await writeFile(watched.accountsPath, accountsDocument('work'), 'utf8');
      await longEnoughForAReaction();

      expect(watched.restarts).toEqual(['codex']);
      expect(watched.notices).toEqual([]);
    },
    EVENT_DRIVEN_TIMEOUT,
  );
});

// Helpers

async function startedWatchers() {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-storage-watchers-'));
  const accountsPath = join(userDataPath, 'accounts.json');
  const restarts: string[] = [];
  const notices: string[] = [];

  temporaryDirectories.push(userDataPath);
  await writeFile(accountsPath, accountsDocument('personal'), 'utf8');

  const watchers = await startStorageWatchers({
    userDataPath,
    lifecycle: {
      restart: (slug) => {
        restarts.push(slug);
      },
      stop: () => undefined,
    },
    onCorrupt: () => undefined,
    onAccountsChanged: () => {
      notices.push('accounts changed');
    },
  });

  openWatchers.push(watchers);

  return {
    accountsPath,
    gatewaysPath: join(userDataPath, 'gateways'),
    notices,
    restarts,
    watchers,
  };
}

async function storeBoth(gatewaysPath: string, served: GatewayConfig): Promise<void> {
  await Promise.all([
    saveGatewayConfig(gatewaysPath, served),
    saveGatewayConfig(gatewaysPath, gatewayDocument('claude', 'Claude')),
  ]);
}

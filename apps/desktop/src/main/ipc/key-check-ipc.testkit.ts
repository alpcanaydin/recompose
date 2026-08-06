import type { IpcResponse, KeyCheckReport } from '@recompose/contracts';

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { StorageIpcContext } from './storage-context';

import { hostOver, nothing, scriptedChild } from '../engine-host/engine-host.testkit';
import { reversibleCodec } from '../storage/safe-storage-codec.testkit';
import { createKeyCheckIpcHandlers } from './key-check-ipc';
import { createStorageIpcHandlers } from './storage-ipc';

export const checkedSecret = 'sk-ant-api03-long-secret-7f2c';

export const checkCodec = reversibleCodec;

export function storageContextOver(userDataPath: string): StorageIpcContext {
  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => checkCodec,
    isEncryptionAvailable: () => true,
    onCorrupt: () => undefined,
    applySettings: () => undefined,
    readLoginItem: () => false,
    startGateway: () => undefined,
    restartGateway: () => undefined,
    releaseSubscription: async () => Promise.resolve({ ok: true }),
  };
}

export async function tempKeyStorage(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-key-check-'));
}

export function checkHandlersOver(
  userDataPath: string,
  codec: SecretCodec,
  answerProbe: () => KeyCheckReport | null,
) {
  const scripted = scriptedChild(nothing, answerProbe);
  const { host } = hostOver(scripted);

  return {
    scripted,
    handlers: createKeyCheckIpcHandlers({
      userDataPath,
      homeFolder: '/Users/ada',
      getCodec: () => codec,
      onCorrupt: () => undefined,
      probe: async (provider, key) => host.probe(provider, key),
    }),
  };
}

export async function connectKeyIn(
  userDataPath: string,
  provider = 'anthropic',
  kind: 'api-key' | 'aggregator' = 'api-key',
): Promise<string> {
  const storage = createStorageIpcHandlers(storageContextOver(userDataPath));

  return connectedKeyId(
    await storage['accounts:connect']({ provider, kind, label: 'build', secret: checkedSecret }),
  );
}

export function connectedKeyId(connected: IpcResponse<'accounts:connect'>): string {
  if (!connected.ok) {
    throw new Error('the key never connected');
  }

  const appended = connected.value.accounts.at(-1);

  if (appended === undefined) {
    throw new Error('the registry holds no row for the connected key');
  }

  return appended.id;
}

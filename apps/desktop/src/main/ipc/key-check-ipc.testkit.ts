import type { IpcResponse, KeyCheckReport } from '@recompose/contracts';

import type { SecretCodec } from '../storage/safe-storage-codec';

import { hostOver, nothing, scriptedChild } from '../engine-host/engine-host.testkit';
import { createKeyCheckIpcHandlers } from './key-check-ipc';

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

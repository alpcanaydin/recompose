import type { GatewayConfig } from '@recompose/contracts';

import type { GatewayLifecycleRequests } from '../engine-host/gateway-lifecycle-requests';

import { startAccountsWatcher } from './accounts-watcher-wiring';
import { startGatewayWatcher } from './gateway-watcher-wiring';

type StorageWatchersOptions = {
  userDataPath: string;
  lifecycle: Pick<GatewayLifecycleRequests, 'restart' | 'stop'>;
  onCorrupt: (quarantinedPath: string) => void;
  onAccountsChanged: () => void;
};

export type StorageWatchers = {
  close: () => void;
  noteGatewayWrite: (gateway: GatewayConfig) => void;
};

export async function startStorageWatchers(
  options: StorageWatchersOptions,
): Promise<StorageWatchers> {
  const [gateway, accounts] = await Promise.all([
    startGatewayWatcher(options),
    startAccountsWatcher({
      userDataPath: options.userDataPath,
      onChanged: options.onAccountsChanged,
    }),
  ]);

  return {
    close: () => {
      accounts.close();
      gateway.close();
    },
    noteGatewayWrite: (config) => {
      gateway.noteWrite(config);
    },
  };
}

import { join } from 'node:path';

import type { GatewayLifecycleRequests } from '../engine-host/gateway-lifecycle-requests';

import { GatewayConfigWatcher } from './gateway-config-watcher';

type WatcherWiring = {
  userDataPath: string;
  lifecycle: Pick<GatewayLifecycleRequests, 'restart' | 'stop'>;
  onCorrupt: (quarantinedPath: string) => void;
  signal?: AbortSignal | undefined;
};

export async function startGatewayWatcher(wiring: WatcherWiring): Promise<GatewayConfigWatcher> {
  const watcher = new GatewayConfigWatcher({
    directory: join(wiring.userDataPath, 'gateways'),
    onUpsert: (gateway) => {
      wiring.lifecycle.restart(gateway.slug);
    },
    onRemove: (slug) => {
      wiring.lifecycle.stop(slug);
    },
    onCorrupt: wiring.onCorrupt,
    onError: (failure) => {
      console.error('recompose could not refresh gateways after a storage change', failure);
    },
  });

  await watcher.start(wiring.signal);

  return watcher;
}

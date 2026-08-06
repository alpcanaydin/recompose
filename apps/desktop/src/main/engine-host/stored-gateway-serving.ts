import type { StorageIpcContext } from '../ipc/storage-context';
import type { EngineHost } from './engine-host';

export function startStoredGateway(engineHost: EngineHost): StorageIpcContext['startGateway'] {
  return (gateway) => {
    engineHost.start(gateway).catch((error: unknown) => {
      console.error(`recompose stored ${gateway.slug} but could not start it`, error);
    });
  };
}

export function serveRewrittenGateway(engineHost: EngineHost): StorageIpcContext['restartGateway'] {
  return (gateway) => {
    engineHost.restart(gateway).catch((error: unknown) => {
      console.error(`recompose rewrote ${gateway.slug} but could not serve it again`, error);
    });
  };
}

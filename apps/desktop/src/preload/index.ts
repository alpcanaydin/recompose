import type { IpcRequest, IpcResponse, RecomposeIpc } from '@recompose/contracts';

import { contextBridge, ipcRenderer } from 'electron';

function bridgeEntry<Channel extends keyof RecomposeIpc>(channel: Channel) {
  return async (request: IpcRequest<Channel>): Promise<IpcResponse<Channel>> =>
    ipcRenderer.invoke(channel, request);
}

const recompose: RecomposeIpc = Object.freeze({
  'gateways:list': bridgeEntry('gateways:list'),
  'gateways:save': bridgeEntry('gateways:save'),
  'settings:get': bridgeEntry('settings:get'),
  'settings:save': bridgeEntry('settings:save'),
  'accounts:list': bridgeEntry('accounts:list'),
  'accounts:connect': bridgeEntry('accounts:connect'),
  'accounts:remove': bridgeEntry('accounts:remove'),
  'system:get': bridgeEntry('system:get'),
  'system:open-config-folder': bridgeEntry('system:open-config-folder'),
  'gateway-token:status': bridgeEntry('gateway-token:status'),
  'gateway-token:mint': bridgeEntry('gateway-token:mint'),
  'gateway-token:copy': bridgeEntry('gateway-token:copy'),
});

contextBridge.exposeInMainWorld('recompose', recompose);

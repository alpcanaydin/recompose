import type {
  IpcEvent,
  IpcEventPayload,
  IpcRequest,
  IpcResponse,
  RecomposeIpc,
  RecomposeIpcEvents,
} from '@recompose/contracts';

import { contextBridge, ipcRenderer } from 'electron';

function bridgeEntry<Channel extends keyof RecomposeIpc>(channel: Channel) {
  return async (request: IpcRequest<Channel>): Promise<IpcResponse<Channel>> =>
    ipcRenderer.invoke(channel, request);
}

function eventEntry<Event extends IpcEvent>(event: Event) {
  return (listener: (payload: IpcEventPayload<Event>) => void) => {
    const handler = (_sent: unknown, payload: IpcEventPayload<Event>): void => {
      listener(payload);
    };

    ipcRenderer.on(event, handler);

    return () => {
      ipcRenderer.off(event, handler);
    };
  };
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
  'system:sidebar-shown': bridgeEntry('system:sidebar-shown'),
  'gateways:offer-port': bridgeEntry('gateways:offer-port'),
  'gateways:move-port': bridgeEntry('gateways:move-port'),
  'engine:start': bridgeEntry('engine:start'),
  'engine:stop': bridgeEntry('engine:stop'),
  'engine:states': bridgeEntry('engine:states'),
});

const recomposeEvents: RecomposeIpcEvents = Object.freeze({
  'engine:state': eventEntry('engine:state'),
});

contextBridge.exposeInMainWorld('recompose', recompose);
contextBridge.exposeInMainWorld('recomposeEvents', recomposeEvents);

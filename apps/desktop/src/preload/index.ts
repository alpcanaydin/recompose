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
  'gateways:update': bridgeEntry('gateways:update'),
  'settings:get': bridgeEntry('settings:get'),
  'settings:save': bridgeEntry('settings:save'),
  'accounts:list': bridgeEntry('accounts:list'),
  'accounts:connect': bridgeEntry('accounts:connect'),
  'accounts:remove': bridgeEntry('accounts:remove'),
  'accounts:check-key': bridgeEntry('accounts:check-key'),
  'accounts:connect-local': bridgeEntry('accounts:connect-local'),
  'accounts:detect-runtime': bridgeEntry('accounts:detect-runtime'),
  'accounts:check-runtime': bridgeEntry('accounts:check-runtime'),
  'accounts:list-models': bridgeEntry('accounts:list-models'),
  'system:get': bridgeEntry('system:get'),
  'system:open-config-folder': bridgeEntry('system:open-config-folder'),
  'system:window-band': bridgeEntry('system:window-band'),
  'system:title-bar-double-click': bridgeEntry('system:title-bar-double-click'),
  'gateways:offer-port': bridgeEntry('gateways:offer-port'),
  'gateways:move-port': bridgeEntry('gateways:move-port'),
  'engine:start': bridgeEntry('engine:start'),
  'engine:stop': bridgeEntry('engine:stop'),
  'engine:states': bridgeEntry('engine:states'),
  'subscriptions:list': bridgeEntry('subscriptions:list'),
  'subscriptions:tools': bridgeEntry('subscriptions:tools'),
  'subscriptions:sign-in': bridgeEntry('subscriptions:sign-in'),
  'subscriptions:restore': bridgeEntry('subscriptions:restore'),
  'subscriptions:activate': bridgeEntry('subscriptions:activate'),
});

const recomposeEvents: RecomposeIpcEvents = Object.freeze({
  'engine:state': eventEntry('engine:state'),
  'accounts:changed': eventEntry('accounts:changed'),
});

contextBridge.exposeInMainWorld('recompose', recompose);
contextBridge.exposeInMainWorld('recomposeEvents', recomposeEvents);

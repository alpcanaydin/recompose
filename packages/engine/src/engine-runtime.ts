import type { EngineGateway, GatewayEngineState } from '@recompose/contracts';

import type { GatewayListeners, openGatewayListeners } from './gateway-listener';

import { createGatewayApp } from './gateway-app';

export type OpenListeners = typeof openGatewayListeners;

export type EngineRuntime = {
  start: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  stop: (slug: string) => Promise<GatewayEngineState>;
};

export function createEngineRuntime(openListeners: OpenListeners): EngineRuntime {
  const serving = new Map<string, GatewayListeners>();

  return {
    start: async (gateway) => {
      if (serving.has(gateway.slug)) {
        return { status: 'running' };
      }

      const outcome = await openListeners(createGatewayApp(gateway), gateway.port);

      if (!('opened' in outcome)) {
        return { status: 'stopped', failure: outcome.failed };
      }

      serving.set(gateway.slug, outcome.opened);

      return { status: 'running' };
    },
    stop: async (slug) => {
      const listeners = serving.get(slug);

      if (listeners !== undefined) {
        serving.delete(slug);
        await listeners.close();
      }

      return { status: 'stopped' };
    },
  };
}

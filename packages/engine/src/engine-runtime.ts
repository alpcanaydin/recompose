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
  const opening = new Map<string, Promise<GatewayEngineState>>();

  async function openFor(gateway: EngineGateway): Promise<GatewayEngineState> {
    const outcome = await openListeners(createGatewayApp(gateway), gateway.port);

    if (!('opened' in outcome)) {
      return { status: 'stopped', failure: outcome.failed };
    }

    serving.set(gateway.slug, outcome.opened);

    return { status: 'running' };
  }

  async function openOnce(gateway: EngineGateway): Promise<GatewayEngineState> {
    const underWay = opening.get(gateway.slug);

    if (underWay !== undefined) {
      return underWay;
    }

    const started = openFor(gateway).finally(() => {
      opening.delete(gateway.slug);
    });

    opening.set(gateway.slug, started);

    return started;
  }

  async function afterAnyOpening(slug: string): Promise<void> {
    await opening.get(slug)?.catch(() => undefined);
  }

  return {
    start: async (gateway) =>
      serving.has(gateway.slug) ? { status: 'running' } : openOnce(gateway),
    stop: async (slug) => {
      await afterAnyOpening(slug);

      const listeners = serving.get(slug);

      if (listeners !== undefined) {
        serving.delete(slug);
        await listeners.close();
      }

      return { status: 'stopped' };
    },
  };
}

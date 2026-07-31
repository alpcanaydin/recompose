import type { EngineGateway, GatewayEngineState } from '@recompose/contracts';

import type { GatewayListeners, openGatewayListeners } from './gateway-listener';

import { createGatewayApp } from './gateway-app';

export type OpenListeners = typeof openGatewayListeners;

export type EngineRuntime = {
  start: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  stop: (slug: string) => Promise<GatewayEngineState>;
};

/**
 * Runs one turn per gateway, so a second caller joins the first rather than racing it.
 *
 * @summary The registry entry lands before the work reaches its first await, which is what keeps
 * a start arriving in the same tick as a stop from stepping over it.
 */
function onlyOnce<Input, Answer>(
  turns: Map<string, Promise<Answer>>,
  slugOf: (input: Input) => string,
  work: (input: Input) => Promise<Answer>,
): (input: Input) => { joined: Promise<Answer> } {
  return (input) => {
    const slug = slugOf(input);
    const underWay = turns.get(slug);

    if (underWay !== undefined) {
      return { joined: underWay };
    }

    const answered = work(input).finally(() => {
      turns.delete(slug);
    });

    turns.set(slug, answered);

    return { joined: answered };
  };
}

export function createEngineRuntime(openListeners: OpenListeners): EngineRuntime {
  const serving = new Map<string, GatewayListeners>();
  const opening = new Map<string, Promise<GatewayEngineState>>();
  const halting = new Map<string, Promise<GatewayEngineState>>();

  async function openFor(gateway: EngineGateway): Promise<GatewayEngineState> {
    const outcome = await openListeners(createGatewayApp(gateway), gateway.port);

    if (!('opened' in outcome)) {
      return { status: 'stopped', failure: outcome.failed };
    }

    serving.set(gateway.slug, outcome.opened);

    return { status: 'running' };
  }

  const openTurn = onlyOnce(opening, (gateway: EngineGateway) => gateway.slug, openFor);

  async function afterAnyOpening(slug: string): Promise<void> {
    await opening.get(slug)?.catch(() => undefined);
  }

  async function haltFor(slug: string): Promise<GatewayEngineState> {
    await afterAnyOpening(slug);

    const listeners = serving.get(slug);

    if (listeners !== undefined) {
      serving.delete(slug);
      await listeners.close();
    }

    return { status: 'stopped' };
  }

  const haltTurn = onlyOnce(halting, (slug: string) => slug, haltFor);

  return {
    start: async (gateway) => {
      const halted = halting.get(gateway.slug);

      if (halted !== undefined) {
        await halted.catch(() => undefined);
      }

      return serving.has(gateway.slug) ? { status: 'running' } : openTurn(gateway).joined;
    },
    stop: async (slug) => haltTurn(slug).joined,
  };
}

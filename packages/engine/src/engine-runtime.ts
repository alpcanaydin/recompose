import type { EngineGateway, GatewayEngineState } from '@recompose/contracts';

import type { SpendGrantFor } from './gateway-app';
import type { GatewayListeners, openGatewayListeners } from './gateway-listener';

import { createGatewayApp } from './gateway-app';

export type OpenListeners = typeof openGatewayListeners;

export type EngineRuntime = {
  start: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  stop: (slug: string) => Promise<GatewayEngineState>;
};

/**
 * Runs one gateway's directives in the order they arrive, never two at once.
 *
 * @summary The turn lands in the registry before the work reaches its first await, so a directive
 * arriving in the same tick queues behind rather than stepping over. Joining an earlier turn is
 * not enough: a stop that joined the halt a start had already waited out would report the gateway
 * down while that start brought it back up.
 */
function oneTurnPerGateway(): <Answer>(
  slug: string,
  work: () => Promise<Answer>,
) => { joined: Promise<Answer> } {
  const turns = new Map<string, Promise<unknown>>();

  return (slug, work) => {
    const ahead = turns.get(slug);
    const answered = ahead === undefined ? work() : ahead.then(work, work);

    turns.set(
      slug,
      answered.then(
        () => undefined,
        () => undefined,
      ),
    );

    return { joined: answered };
  };
}

export function createEngineRuntime(
  openListeners: OpenListeners,
  spendGrantFor: SpendGrantFor,
  fetchLike: typeof fetch = globalThis.fetch,
): EngineRuntime {
  const serving = new Map<string, GatewayListeners>();
  const inTurn = oneTurnPerGateway();

  async function openFor(gateway: EngineGateway): Promise<GatewayEngineState> {
    const outcome = await openListeners(
      createGatewayApp(gateway, spendGrantFor, fetchLike),
      gateway.port,
    );

    if (!('opened' in outcome)) {
      return { status: 'stopped', failure: outcome.failed };
    }

    serving.set(gateway.slug, outcome.opened);

    return { status: 'running' };
  }

  async function haltFor(slug: string): Promise<GatewayEngineState> {
    const listeners = serving.get(slug);

    if (listeners !== undefined) {
      serving.delete(slug);
      await listeners.close();
    }

    return { status: 'stopped' };
  }

  return {
    start: async (gateway) =>
      inTurn<GatewayEngineState>(gateway.slug, async () =>
        serving.has(gateway.slug) ? { status: 'running' } : openFor(gateway),
      ).joined,
    stop: async (slug) => inTurn(slug, async () => haltFor(slug)).joined,
  };
}

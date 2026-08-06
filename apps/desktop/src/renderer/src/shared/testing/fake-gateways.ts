import type { EngineStates, GatewayConfig, RecomposeIpc, VirtualModel } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION, ipcChannels } from '@recompose/contracts';

export type GatewayHandlers = Pick<
  RecomposeIpc,
  | 'gateways:list'
  | 'gateways:save'
  | 'gateways:update'
  | 'gateways:offer-port'
  | 'gateways:move-port'
  | 'engine:start'
  | 'engine:stop'
  | 'engine:states'
>;

export type GatewaySeed = {
  /** Identifier the gateway stores under and answers to. */
  slug: string;
  /** Name the sidebar and the toolbar show. */
  displayName: string;
  /** Loopback port the gateway binds. */
  port: number;
  /** Definitions the stored gateway already serves, which a fresh gateway holds none of. */
  virtualModels?: readonly VirtualModel[];
};

/** A stored gateway document, filled out around the fields a scenario cares about. */
export function gatewaySeed({
  slug,
  displayName,
  port,
  virtualModels = [],
}: GatewaySeed): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug,
    displayName,
    port,
    virtualModels: [...virtualModels],
    layout: { nodes: {} },
  };
}

const FIRST_OFFERED_PORT = 51234;

type EngineStatesListener = (states: EngineStates) => void;

const engineStateListeners = new Set<EngineStatesListener>();

export function forgetEngineStateListeners(): void {
  engineStateListeners.clear();
}

export function listenForEngineStates(listener: EngineStatesListener): () => void {
  engineStateListeners.add(listener);

  return () => {
    engineStateListeners.delete(listener);
  };
}

/**
 * Pushes a lifecycle snapshot at everything listening, the way the main process would.
 *
 * @summary Reach for it in a story or a spec that has to show state arriving on its own, with
 * nothing on screen having asked for it.
 */
export function emitEngineStates(states: EngineStates): void {
  for (const listener of engineStateListeners) {
    listener(states);
  }
}

type Refusal = { code: 'validation-failed' | 'name-conflict' | 'port-conflict'; message: string };

function conflictIn(
  stored: readonly GatewayConfig[],
  arriving: GatewayConfig,
): Refusal | undefined {
  const namesake = stored.find((held) => held.slug === arriving.slug);

  if (namesake !== undefined) {
    return {
      code: 'name-conflict',
      message: `Another gateway already holds the name "${namesake.displayName}".`,
    };
  }

  const portHolder = stored.find((held) => held.port === arriving.port);

  if (portHolder !== undefined) {
    return { code: 'port-conflict', message: `${portHolder.slug} already holds this port.` };
  }

  return undefined;
}

function malformed(channel: 'gateways:save' | 'gateways:update', arriving: GatewayConfig) {
  const parsed = ipcChannels[channel].request.safeParse(arriving);

  return parsed.success
    ? undefined
    : { code: 'validation-failed' as const, message: parsed.error.message };
}

function unheldSlug(slug: string): { code: 'storage-failed'; message: string } {
  return {
    code: 'storage-failed',
    message: `recompose stores no gateway under the slug "${slug}", so it has nothing to rewrite.`,
  };
}

type Landing = { ok: true; value: GatewayConfig[] };

type GatewayStore = {
  held: () => GatewayConfig[];
  freePort: () => number;
  states: () => EngineStates;
  isServing: (slug: string) => boolean;
  report: (slug: string, state: EngineStates[string]) => void;
  land: (next: readonly GatewayConfig[], slug: string) => Landing;
  landWithoutServing: (next: readonly GatewayConfig[]) => Landing;
};

function openGatewayStore(
  seededGateways: readonly GatewayConfig[],
  seededStates: EngineStates,
): GatewayStore {
  let stored = [...seededGateways];
  let states = { ...seededStates };

  function report(slug: string, state: EngineStates[string]): void {
    states = { ...states, [slug]: state };
    emitEngineStates(states);
  }

  return {
    held: () => stored,
    freePort: () => {
      let offer = FIRST_OFFERED_PORT;

      while (stored.some((gateway) => gateway.port === offer)) {
        offer += 1;
      }

      return offer;
    },
    states: () => states,
    isServing: (slug) => states[slug]?.status === 'running',
    report,
    land: (next, slug) => {
      stored = [...next];
      report(slug, { status: 'running' });

      return { ok: true as const, value: stored };
    },
    landWithoutServing: (next) => {
      stored = [...next];

      return { ok: true as const, value: stored };
    },
  };
}

function savingGateway(store: GatewayStore): GatewayHandlers['gateways:save'] {
  return async (gateway) => {
    const refused = malformed('gateways:save', gateway) ?? conflictIn(store.held(), gateway);

    return Promise.resolve(
      refused === undefined
        ? store.land([...store.held(), gateway], gateway.slug)
        : { ok: false, error: refused },
    );
  };
}

function rewritingGateway(store: GatewayStore): GatewayHandlers['gateways:update'] {
  return async (gateway) => {
    const malformation = malformed('gateways:update', gateway);

    if (malformation !== undefined) {
      return Promise.resolve({ ok: false, error: malformation });
    }

    const held = store.held().find((one) => one.slug === gateway.slug);

    if (held === undefined) {
      return Promise.resolve({ ok: false, error: unheldSlug(gateway.slug) });
    }

    const rewritten = { ...gateway, port: held.port };
    const next = store.held().map((one) => (one.slug === gateway.slug ? rewritten : one));

    return Promise.resolve(
      store.isServing(gateway.slug)
        ? store.land(next, gateway.slug)
        : store.landWithoutServing(next),
    );
  };
}

/**
 * The gateway half of the fake bridge, mirroring what main does with a stored document.
 *
 * @summary The save refuses a slug or a port already held and the update refuses a slug nothing is
 * held under, because a scenario that goes green over a double contradicting main proves nothing. A
 * save serves at once, the way main hands the engine the fresh snapshot. An update serves only what
 * was already serving, because main leaves a gateway a person stopped stopped, and a fake that
 * started one would let a surface go green over a stop it quietly undid.
 */
export function gatewayHandlers(
  seededGateways: readonly GatewayConfig[],
  seededStates: EngineStates,
): GatewayHandlers {
  const store = openGatewayStore(seededGateways, seededStates);

  return {
    'gateways:list': async () => Promise.resolve({ ok: true, value: store.held() }),
    'gateways:save': savingGateway(store),
    'gateways:update': rewritingGateway(store),
    'gateways:offer-port': async () => Promise.resolve({ ok: true, value: store.freePort() }),
    'gateways:move-port': async ({ slug }) => {
      const moved = store.freePort();

      return Promise.resolve(
        store.land(
          store
            .held()
            .map((gateway) => (gateway.slug === slug ? { ...gateway, port: moved } : gateway)),
          slug,
        ),
      );
    },
    'engine:start': async ({ slug }) => {
      store.report(slug, { status: 'running' });

      return Promise.resolve({ ok: true, value: { status: 'running' } });
    },
    'engine:stop': async ({ slug }) => {
      store.report(slug, { status: 'stopped' });

      return Promise.resolve({ ok: true, value: { status: 'stopped' } });
    },
    'engine:states': async () => Promise.resolve({ ok: true, value: store.states() }),
  };
}

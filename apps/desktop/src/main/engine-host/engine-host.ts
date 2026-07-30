import {
  engineReportSchema,
  type EngineDirective,
  type EngineGateway,
  type EngineStates,
  type GatewayEngineState,
} from '@recompose/contracts';

import { allStopped, foldEngineReport } from './engine-state-ledger';
import { createGatewayOrder } from './gateway-order';

export const DIRECTIVE_TIMEOUT_MS = 5000;

export type EngineChild = {
  postMessage: (directive: EngineDirective) => void;
  onMessage: (listener: (message: unknown) => void) => void;
  onExit: (listener: (code: number) => void) => void;
  kill: () => void;
};

export type EngineHostDeps = {
  knownSlugs: readonly string[];
  spawnChild: () => EngineChild;
};

export type EngineHost = {
  start: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  stop: (slug: string) => Promise<GatewayEngineState>;
  restart: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  states: () => EngineStates;
  onStatesChanged: (listener: (states: EngineStates) => void) => () => void;
  dispose: () => void;
};

type StateListener = (states: EngineStates) => void;

type Resident = {
  states: EngineStates;
  child: EngineChild | null;
  spawnChild: () => EngineChild;
  subscribers: Set<StateListener>;
  awaitingReport: Map<string, (state: GatewayEngineState) => void>;
};

function publish(resident: Resident, next: EngineStates): void {
  resident.states = next;

  for (const subscriber of resident.subscribers) {
    subscriber(next);
  }
}

function settleWaiter(resident: Resident, slug: string, state: GatewayEngineState): void {
  const waiting = resident.awaitingReport.get(slug);

  resident.awaitingReport.delete(slug);
  waiting?.(state);
}

function receiveReport(resident: Resident, message: unknown): void {
  const report = engineReportSchema.safeParse(message);

  if (!report.success) {
    console.error('recompose could not read a report from the engine.', report.error.issues);

    return;
  }

  publish(resident, foldEngineReport(resident.states, report.data));
  settleWaiter(resident, report.data.slug, report.data.state);
}

function receiveExit(resident: Resident, code: number): void {
  console.error(
    `The engine stopped on its own with exit code ${String(code)}, so every gateway now reads stopped.`,
  );

  resident.child = null;
  publish(resident, allStopped(Object.keys(resident.states)));

  for (const slug of resident.awaitingReport.keys()) {
    settleWaiter(resident, slug, { status: 'stopped' });
  }
}

function runningChild(resident: Resident): EngineChild {
  if (resident.child !== null) {
    return resident.child;
  }

  const spawned = resident.spawnChild();

  spawned.onMessage((message) => {
    receiveReport(resident, message);
  });
  spawned.onExit((code) => {
    receiveExit(resident, code);
  });
  resident.child = spawned;

  return spawned;
}

async function sendDirective(
  resident: Resident,
  slug: string,
  directive: EngineDirective,
): Promise<GatewayEngineState> {
  const engine = runningChild(resident);

  return new Promise<GatewayEngineState>((answer, refuse) => {
    const giveUp = setTimeout(() => {
      resident.awaitingReport.delete(slug);
      refuse(
        new Error(
          `The engine did not report on the ${directive.kind} of the gateway "${slug}" within ${String(DIRECTIVE_TIMEOUT_MS)}ms.`,
        ),
      );
    }, DIRECTIVE_TIMEOUT_MS);

    resident.awaitingReport.set(slug, (state) => {
      clearTimeout(giveUp);
      answer(state);
    });

    engine.postMessage(directive);
  });
}

export function createEngineHost(deps: EngineHostDeps): EngineHost {
  const resident: Resident = {
    states: allStopped(deps.knownSlugs),
    child: null,
    spawnChild: deps.spawnChild,
    subscribers: new Set(),
    awaitingReport: new Map(),
  };
  const inGatewayOrder = createGatewayOrder();

  return {
    start: async (gateway) =>
      inGatewayOrder(gateway.slug, async () =>
        sendDirective(resident, gateway.slug, { kind: 'start', gateway }),
      ),
    stop: async (slug) =>
      inGatewayOrder(slug, async () => sendDirective(resident, slug, { kind: 'stop', slug })),
    restart: async (gateway) =>
      inGatewayOrder(gateway.slug, async () => {
        await sendDirective(resident, gateway.slug, { kind: 'stop', slug: gateway.slug });

        return sendDirective(resident, gateway.slug, { kind: 'start', gateway });
      }),
    states: () => resident.states,
    onStatesChanged: (listener) => {
      resident.subscribers.add(listener);

      return () => {
        resident.subscribers.delete(listener);
      };
    },
    dispose: () => {
      resident.child?.kill();
      resident.child = null;
    },
  };
}

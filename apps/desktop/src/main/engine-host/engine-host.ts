import {
  engineReportSchema,
  type EngineDirective,
  type EngineGateway,
  type EngineStates,
  type GatewayEngineState,
} from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

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

type Waiter = {
  answer: (state: GatewayEngineState) => void;
  refuse: (reason: Error) => void;
};

type Resident = {
  states: EngineStates;
  child: EngineChild | null;
  spawnChild: () => EngineChild;
  subscribers: Set<StateListener>;
  awaitingReport: Map<string, Waiter>;
};

function publish(resident: Resident, next: EngineStates): void {
  resident.states = next;

  for (const subscriber of resident.subscribers) {
    subscriber(next);
  }
}

function refuseEveryWaiter(resident: Resident, reason: Error): void {
  const waiting = [...resident.awaitingReport.values()];

  resident.awaitingReport.clear();

  for (const waiter of waiting) {
    waiter.refuse(reason);
  }
}

function receiveReport(resident: Resident, message: unknown): void {
  const report = engineReportSchema.safeParse(message);

  if (!report.success) {
    console.error('recompose could not read a report from the engine.', report.error.issues);

    return;
  }

  if (report.data.kind !== 'state') {
    console.error('recompose dropped a key-check report, because nothing waits on a probe yet.');

    return;
  }

  const waiting = resident.awaitingReport.get(report.data.answers);

  if (waiting === undefined) {
    console.error(
      `recompose dropped a report on the gateway "${report.data.slug}", because the directive it answers had already been given up on.`,
    );

    return;
  }

  resident.awaitingReport.delete(report.data.answers);
  publish(resident, foldEngineReport(resident.states, report.data));
  waiting.answer(report.data.state);
}

function receiveExit(resident: Resident, code: number): void {
  const death = new Error(
    `The engine stopped on its own with exit code ${String(code)}, so no gateway is serving.`,
  );

  console.error(death.message);

  resident.child = null;
  publish(resident, allStopped(Object.keys(resident.states)));
  refuseEveryWaiter(resident, death);
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

type GatewayDirective = Exclude<EngineDirective, { kind: 'probe' }>;

function gatewayOf(directive: GatewayDirective): string {
  return directive.kind === 'start' ? directive.gateway.slug : directive.slug;
}

async function sendDirective(
  resident: Resident,
  directive: GatewayDirective,
): Promise<GatewayEngineState> {
  const engine = runningChild(resident);
  const slug = gatewayOf(directive);

  return new Promise<GatewayEngineState>((answer, refuse) => {
    const giveUp = setTimeout(() => {
      resident.awaitingReport.delete(directive.id);
      refuse(
        new Error(
          `The engine did not report on the ${directive.kind} of the gateway "${slug}" within ${String(DIRECTIVE_TIMEOUT_MS)}ms.`,
        ),
      );
    }, DIRECTIVE_TIMEOUT_MS);

    resident.awaitingReport.set(directive.id, {
      answer: (state) => {
        clearTimeout(giveUp);
        answer(state);
      },
      refuse: (reason) => {
        clearTimeout(giveUp);
        refuse(reason);
      },
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
        sendDirective(resident, { kind: 'start', id: randomUUID(), gateway }),
      ),
    stop: async (slug) =>
      inGatewayOrder(slug, async () =>
        sendDirective(resident, { kind: 'stop', id: randomUUID(), slug }),
      ),
    restart: async (gateway) =>
      inGatewayOrder(gateway.slug, async () => {
        await sendDirective(resident, {
          kind: 'stop',
          id: randomUUID(),
          slug: gateway.slug,
        }).catch((error: unknown) => {
          console.error(
            `recompose never heard the stop of the gateway "${gateway.slug}" back, and is starting it again regardless.`,
            error,
          );
        });

        return sendDirective(resident, { kind: 'start', id: randomUUID(), gateway });
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

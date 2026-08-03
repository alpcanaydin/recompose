import {
  engineReportSchema,
  type EngineDirective,
  type EngineGateway,
  type EngineReport,
  type EngineStates,
  type GatewayEngineState,
  type KeyCheckReport,
  type KeyProviderId,
} from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import {
  answerKeyCheck,
  createProbeDesk,
  foldEveryProbe,
  sendProbe,
  type ProbeDesk,
} from './engine-probe';
import { allStopped, foldEngineReport } from './engine-state-ledger';
import { createGatewayOrder } from './gateway-order';

export const DIRECTIVE_TIMEOUT_MS = 5000;

export { PROBE_TIMEOUT_MS } from './engine-probe';

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
  probe: (provider: KeyProviderId, key: string) => Promise<KeyCheckReport>;
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
  awaitingKeyCheck: ProbeDesk;
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

function answerState(resident: Resident, report: Extract<EngineReport, { kind: 'state' }>): void {
  const waiting = resident.awaitingReport.get(report.answers);

  if (waiting === undefined) {
    console.error(
      `recompose dropped a report on the gateway "${report.slug}", because the directive it answers had already been given up on.`,
    );

    return;
  }

  resident.awaitingReport.delete(report.answers);
  publish(resident, foldEngineReport(resident.states, report));
  waiting.answer(report.state);
}

function receiveReport(resident: Resident, message: unknown): void {
  const report = engineReportSchema.safeParse(message);

  if (!report.success) {
    console.error('recompose could not read a report from the engine.', report.error.issues);

    return;
  }

  if (report.data.kind === 'key-check') {
    answerKeyCheck(resident.awaitingKeyCheck, report.data);

    return;
  }

  answerState(resident, report.data);
}

function receiveExit(resident: Resident, code: number): void {
  const death = new Error(
    `The engine stopped on its own with exit code ${String(code)}, so no gateway is serving.`,
  );

  console.error(death.message);

  resident.child = null;
  publish(resident, allStopped(Object.keys(resident.states)));
  refuseEveryWaiter(resident, death);
  foldEveryProbe(
    resident.awaitingKeyCheck,
    (provider) =>
      `recompose could not check the ${provider} key, because the engine stopped before it answered.`,
  );
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

async function probeThroughTheChild(
  resident: Resident,
  provider: KeyProviderId,
  key: string,
): Promise<KeyCheckReport> {
  let engine: EngineChild;

  try {
    engine = runningChild(resident);
  } catch (error) {
    console.error(
      `recompose could not check the ${provider} key, because the engine would not spawn.`,
      error,
    );

    return { verdict: 'could-not-check' };
  }

  return sendProbe(resident.awaitingKeyCheck, engine, provider, key);
}

export function createEngineHost(deps: EngineHostDeps): EngineHost {
  const resident: Resident = {
    states: allStopped(deps.knownSlugs),
    child: null,
    spawnChild: deps.spawnChild,
    subscribers: new Set(),
    awaitingReport: new Map(),
    awaitingKeyCheck: createProbeDesk(),
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
    probe: async (provider, key) => probeThroughTheChild(resident, provider, key),
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

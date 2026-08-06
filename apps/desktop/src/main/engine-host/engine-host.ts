import {
  engineReportSchema,
  engineSpendRequestSchema,
  type EngineDirective,
  type EngineGateway,
  type EngineReport,
  type EngineSpendGrant,
  type EngineStates,
  type GatewayEngineState,
  type KeyCheckReport,
  type KeyProviderId,
  type RuntimeReachability,
} from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { SpendGrantFor } from './engine-spend';

import {
  answerKeyCheck,
  answerRuntimeCheck,
  createProbeDesk,
  foldEveryProbe,
  lookAtTheRuntimeThroughTheChild,
  probeThroughTheChild,
  type ProbeDesk,
} from './engine-probe';
import { answerSpendRequest } from './engine-spend';
import { allStopped, foldEngineReport } from './engine-state-ledger';
import { createGatewayOrder } from './gateway-order';

export const DIRECTIVE_TIMEOUT_MS = 5000;

export { PROBE_TIMEOUT_MS } from './engine-probe';

export type EngineChild = {
  postMessage: (message: EngineDirective | EngineSpendGrant) => void;
  onMessage: (listener: (message: unknown) => void) => void;
  onExit: (listener: (code: number) => void) => void;
  kill: () => void;
};

export type EngineHostDeps = {
  knownSlugs: readonly string[];
  spawnChild: () => EngineChild;
  grantFor: SpendGrantFor;
};

export type EngineHost = {
  start: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  stop: (slug: string) => Promise<GatewayEngineState>;
  restart: (gateway: EngineGateway) => Promise<GatewayEngineState>;
  probe: (provider: KeyProviderId, key: string) => Promise<KeyCheckReport>;
  probeRuntime: (address: string) => Promise<RuntimeReachability>;
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
  grantFor: SpendGrantFor;
  subscribers: Set<StateListener>;
  awaitingReport: Map<string, Waiter>;
  awaitingKeyCheck: ProbeDesk<KeyCheckReport>;
  awaitingRuntimeLook: ProbeDesk<RuntimeReachability>;
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

function routeReport(resident: Resident, report: EngineReport): void {
  if (report.kind === 'key-check') {
    answerKeyCheck(resident.awaitingKeyCheck, report);

    return;
  }

  if (report.kind === 'runtime-check') {
    answerRuntimeCheck(resident.awaitingRuntimeLook, report);

    return;
  }

  answerState(resident, report);
}

function receiveMessage(resident: Resident, child: EngineChild, message: unknown): void {
  const report = engineReportSchema.safeParse(message);

  if (report.success) {
    routeReport(resident, report.data);

    return;
  }

  const asked = engineSpendRequestSchema.safeParse(message);

  if (asked.success) {
    answerSpendRequest(child, resident.grantFor, asked.data);

    return;
  }

  console.error('recompose could not read a report from the engine.', report.error.issues);
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
    { verdict: 'could-not-check' },
    (provider) =>
      `recompose could not check the ${provider} key, because the engine stopped before it answered.`,
  );
  foldEveryProbe(
    resident.awaitingRuntimeLook,
    { verdict: 'unreachable' },
    (address) =>
      `recompose could not look at the runtime at ${address}, because the engine stopped before it answered.`,
  );
}

function runningChild(resident: Resident): EngineChild {
  if (resident.child !== null) {
    return resident.child;
  }

  const spawned = resident.spawnChild();

  spawned.onMessage((message) => {
    receiveMessage(resident, spawned, message);
  });
  spawned.onExit((code) => {
    receiveExit(resident, code);
  });
  resident.child = spawned;

  return spawned;
}

type GatewayDirective = Extract<EngineDirective, { kind: 'start' | 'stop' }>;

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

async function restartGateway(
  resident: Resident,
  gateway: EngineGateway,
): Promise<GatewayEngineState> {
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
}

export function createEngineHost(deps: EngineHostDeps): EngineHost {
  const resident: Resident = {
    states: allStopped(deps.knownSlugs),
    child: null,
    spawnChild: deps.spawnChild,
    grantFor: deps.grantFor,
    subscribers: new Set(),
    awaitingReport: new Map(),
    awaitingKeyCheck: createProbeDesk(),
    awaitingRuntimeLook: createProbeDesk(),
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
      inGatewayOrder(gateway.slug, async () => restartGateway(resident, gateway)),
    probe: async (provider, key) =>
      probeThroughTheChild(resident.awaitingKeyCheck, () => runningChild(resident), provider, key),
    probeRuntime: async (address) =>
      lookAtTheRuntimeThroughTheChild(
        resident.awaitingRuntimeLook,
        () => runningChild(resident),
        address,
      ),
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

import {
  engineReportSchema,
  engineSpendRequestSchema,
  engineSubscriptionCredentialUpdateSchema,
  type EngineDirective,
  type EngineGateway,
  type EngineReport,
  type EngineStates,
  type GatewayEngineState,
} from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { EngineChild, EngineHost, EngineHostDeps } from './engine-host-types';
import type { EngineLooks } from './engine-looks';
import type { SpendGrantFor } from './engine-spend';

import {
  answerLook,
  foldEveryLook,
  listModelsThroughTheChild,
  lookAtTheRuntimeThroughTheChild,
  openEngineLooks,
  probeThroughTheChild,
} from './engine-looks';
import { answerSpendRequest } from './engine-spend';
import { allStopped, foldEngineReport } from './engine-state-ledger';
import { createGatewayOrder } from './gateway-order';

export const DIRECTIVE_TIMEOUT_MS = 5000;

export { PROBE_TIMEOUT_MS } from './engine-looks';
export type { EngineChild, EngineHost, EngineHostDeps } from './engine-host-types';

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
  storeSubscriptionCredential: NonNullable<EngineHostDeps['storeSubscriptionCredential']>;
  subscribers: Set<StateListener>;
  awaitingReport: Map<string, Waiter>;
  looks: EngineLooks;
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
  if (report.kind === 'state') {
    answerState(resident, report);

    return;
  }

  answerLook(resident.looks, report);
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

  const update = engineSubscriptionCredentialUpdateSchema.safeParse(message);

  if (update.success) {
    void resident
      .storeSubscriptionCredential(
        update.data.provider,
        update.data.accountId,
        update.data.credential,
      )
      .then(
        () => {
          child.postMessage({
            kind: 'subscription-credential-updated',
            answers: update.data.id,
            verdict: 'stored',
          });
        },
        (error: unknown) => {
          console.error('recompose could not persist a refreshed subscription credential.', error);
          child.postMessage({
            kind: 'subscription-credential-updated',
            answers: update.data.id,
            verdict: 'failed',
          });
        },
      );

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
  foldEveryLook(resident.looks);
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
    storeSubscriptionCredential:
      deps.storeSubscriptionCredential ??
      (async () => {
        await Promise.reject(new Error('subscription credential persistence is unavailable'));
      }),
    subscribers: new Set(),
    awaitingReport: new Map(),
    looks: openEngineLooks(),
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
      probeThroughTheChild(resident.looks, () => runningChild(resident), provider, key),
    probeRuntime: async (address) =>
      lookAtTheRuntimeThroughTheChild(resident.looks, () => runningChild(resident), address),
    listModels: async (origin, custody) =>
      listModelsThroughTheChild(resident.looks, () => runningChild(resident), origin, custody),
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

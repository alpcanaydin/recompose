import type {
  EngineDirective,
  EngineReport,
  KeyCheckReport,
  KeyProviderId,
  LookCustody,
  ModelListing,
  RuntimeReachability,
} from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

export const PROBE_TIMEOUT_MS = 15_000;

type Waiter<Answer> = {
  subject: string;
  answer: (answer: Answer) => void;
};

type LookPort = {
  postMessage: (directive: EngineDirective) => void;
};

type LookDesk<Answer> = Map<string, Waiter<Answer>>;

function openDesk<Answer>(): LookDesk<Answer> {
  return new Map();
}

function answerWaiting<Answer>(
  desk: LookDesk<Answer>,
  answers: string,
  answer: Answer,
  dropped: string,
): void {
  const waiting = desk.get(answers);

  if (waiting === undefined) {
    console.error(dropped);

    return;
  }

  desk.delete(answers);
  waiting.answer(answer);
}

function foldEveryWaiter<Answer>(
  desk: LookDesk<Answer>,
  fold: Answer,
  why: (subject: string) => string,
): void {
  const waiting = [...desk.values()];

  desk.clear();

  for (const waiter of waiting) {
    console.error(why(waiter.subject));
    waiter.answer(fold);
  }
}

type Ask<Answer> = {
  desk: LookDesk<Answer>;
  directive: EngineDirective;
  subject: string;
  fold: Answer;
  unanswered: string;
  unspawned: string;
};

async function waitOnTheChild<Answer>(engine: LookPort, ask: Ask<Answer>): Promise<Answer> {
  return new Promise<Answer>((answer) => {
    const giveUp = setTimeout(() => {
      ask.desk.delete(ask.directive.id);
      console.error(ask.unanswered);
      answer(ask.fold);
    }, PROBE_TIMEOUT_MS);

    ask.desk.set(ask.directive.id, {
      subject: ask.subject,
      answer: (given) => {
        clearTimeout(giveUp);
        answer(given);
      },
    });

    engine.postMessage(ask.directive);
  });
}

async function askTheChild<Answer>(engineOf: () => LookPort, ask: Ask<Answer>): Promise<Answer> {
  let engine: LookPort;

  try {
    engine = engineOf();
  } catch (error) {
    console.error(ask.unspawned, error);

    return ask.fold;
  }

  return waitOnTheChild(engine, ask);
}

/**
 * Every look the host has out through the child, one desk per kind of answer.
 *
 * @summary The three share a bound and a shape: a directive goes out under a fresh id, one answer
 * comes back against it, and silence folds to the reading that says nothing was learned. They stay
 * separate desks so a key check can never be handed a model list, and they travel as one value so
 * the host holds a single field for all of them.
 */
export type EngineLooks = {
  keyChecks: LookDesk<KeyCheckReport>;
  runtimeReadings: LookDesk<RuntimeReachability>;
  modelLists: LookDesk<ModelListing>;
};

export function openEngineLooks(): EngineLooks {
  return { keyChecks: openDesk(), runtimeReadings: openDesk(), modelLists: openDesk() };
}

const couldNotCheck: KeyCheckReport = { verdict: 'could-not-check' };
const unreachable: RuntimeReachability = { verdict: 'unreachable' };
const nothingListed: ModelListing = { standing: 'unlisted' };

function keyCheckOf(report: Extract<EngineReport, { kind: 'key-check' }>): KeyCheckReport {
  return {
    verdict: report.verdict,
    ...(report.status === undefined ? {} : { status: report.status }),
  };
}

/** Every report that answers a look rather than a gateway's own lifecycle. */
export type LookReport = Extract<
  EngineReport,
  { kind: 'key-check' | 'runtime-check' | 'model-list' }
>;

/**
 * Hands one report to the look it answers.
 *
 * @summary A report whose look was already given up on is written down rather than passed over,
 * because a caller who stopped waiting still deserves the record of what arrived too late.
 */
export function answerLook(looks: EngineLooks, report: LookReport): void {
  if (report.kind === 'key-check') {
    answerWaiting(
      looks.keyChecks,
      report.answers,
      keyCheckOf(report),
      'recompose dropped a key-check report, because the probe it answers had already been given up on.',
    );

    return;
  }

  if (report.kind === 'runtime-check') {
    answerWaiting(
      looks.runtimeReadings,
      report.answers,
      report.reachability,
      'recompose dropped a runtime reading, because the look it answers had already been given up on.',
    );

    return;
  }

  answerWaiting(
    looks.modelLists,
    report.answers,
    report.listing,
    'recompose dropped a model list, because the look it answers had already been given up on.',
  );
}

export function foldEveryLook(looks: EngineLooks): void {
  foldEveryWaiter(
    looks.keyChecks,
    couldNotCheck,
    (provider) =>
      `recompose could not check the ${provider} key, because the engine stopped before it answered.`,
  );
  foldEveryWaiter(
    looks.runtimeReadings,
    unreachable,
    (address) =>
      `recompose could not look at the runtime at ${address}, because the engine stopped before it answered.`,
  );
  foldEveryWaiter(
    looks.modelLists,
    nothingListed,
    (origin) =>
      `recompose could not read the model list at ${origin}, because the engine stopped before it answered.`,
  );
}

export async function probeThroughTheChild(
  looks: EngineLooks,
  engineOf: () => LookPort,
  provider: KeyProviderId,
  key: string,
): Promise<KeyCheckReport> {
  return askTheChild(engineOf, {
    desk: looks.keyChecks,
    directive: { kind: 'probe', id: randomUUID(), provider, key },
    subject: provider,
    fold: couldNotCheck,
    unanswered: `recompose could not check the ${provider} key within ${String(PROBE_TIMEOUT_MS)}ms.`,
    unspawned: `recompose could not check the ${provider} key, because the engine would not spawn.`,
  });
}

export async function lookAtTheRuntimeThroughTheChild(
  looks: EngineLooks,
  engineOf: () => LookPort,
  address: string,
): Promise<RuntimeReachability> {
  return askTheChild(engineOf, {
    desk: looks.runtimeReadings,
    directive: { kind: 'probe-runtime', id: randomUUID(), address },
    subject: address,
    fold: unreachable,
    unanswered: `recompose could not look at the runtime at ${address} within ${String(PROBE_TIMEOUT_MS)}ms.`,
    unspawned: `recompose could not look at the runtime at ${address}, because the engine would not spawn.`,
  });
}

export async function listModelsThroughTheChild(
  looks: EngineLooks,
  engineOf: () => LookPort,
  origin: string,
  custody: LookCustody,
): Promise<ModelListing> {
  return askTheChild(engineOf, {
    desk: looks.modelLists,
    directive: { kind: 'list-models', id: randomUUID(), origin, custody },
    subject: origin,
    fold: nothingListed,
    unanswered: `recompose could not read the model list at ${origin} within ${String(PROBE_TIMEOUT_MS)}ms.`,
    unspawned: `recompose could not read the model list at ${origin}, because the engine would not spawn.`,
  });
}

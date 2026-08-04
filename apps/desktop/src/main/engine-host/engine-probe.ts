import type {
  EngineDirective,
  EngineReport,
  KeyCheckReport,
  KeyProviderId,
  RuntimeReachability,
} from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

export const PROBE_TIMEOUT_MS = 15_000;

type ProbeWaiter<Report> = {
  subject: string;
  answer: (report: Report) => void;
};

type ProbePort = {
  postMessage: (directive: EngineDirective) => void;
};

type GivenUp<Report> = {
  subject: string;
  fold: Report;
  why: string;
};

export type ProbeDesk<Report> = Map<string, ProbeWaiter<Report>>;

export function createProbeDesk<Report>(): ProbeDesk<Report> {
  return new Map();
}

function answerWaiting<Report>(
  desk: ProbeDesk<Report>,
  answers: string,
  report: Report,
  dropped: string,
): void {
  const waiting = desk.get(answers);

  if (waiting === undefined) {
    console.error(dropped);

    return;
  }

  desk.delete(answers);
  waiting.answer(report);
}

export function answerKeyCheck(
  desk: ProbeDesk<KeyCheckReport>,
  report: Extract<EngineReport, { kind: 'key-check' }>,
): void {
  answerWaiting(
    desk,
    report.answers,
    { verdict: report.verdict, ...(report.status === undefined ? {} : { status: report.status }) },
    'recompose dropped a key-check report, because the probe it answers had already been given up on.',
  );
}

export function answerRuntimeCheck(
  desk: ProbeDesk<RuntimeReachability>,
  report: Extract<EngineReport, { kind: 'runtime-check' }>,
): void {
  answerWaiting(
    desk,
    report.answers,
    report.reachability,
    'recompose dropped a runtime reading, because the look it answers had already been given up on.',
  );
}

export function foldEveryProbe<Report>(
  desk: ProbeDesk<Report>,
  fold: Report,
  why: (subject: string) => string,
): void {
  const waiting = [...desk.values()];

  desk.clear();

  for (const waiter of waiting) {
    console.error(why(waiter.subject));
    waiter.answer(fold);
  }
}

async function sendAndWait<Report>(
  desk: ProbeDesk<Report>,
  engine: ProbePort,
  directive: EngineDirective,
  givenUp: GivenUp<Report>,
): Promise<Report> {
  return new Promise<Report>((answer) => {
    const giveUp = setTimeout(() => {
      desk.delete(directive.id);
      console.error(givenUp.why);
      answer(givenUp.fold);
    }, PROBE_TIMEOUT_MS);

    desk.set(directive.id, {
      subject: givenUp.subject,
      answer: (report) => {
        clearTimeout(giveUp);
        answer(report);
      },
    });

    engine.postMessage(directive);
  });
}

export async function sendProbe(
  desk: ProbeDesk<KeyCheckReport>,
  engine: ProbePort,
  provider: KeyProviderId,
  key: string,
): Promise<KeyCheckReport> {
  return sendAndWait(
    desk,
    engine,
    { kind: 'probe', id: randomUUID(), provider, key },
    {
      subject: provider,
      fold: { verdict: 'could-not-check' },
      why: `recompose could not check the ${provider} key within ${String(PROBE_TIMEOUT_MS)}ms.`,
    },
  );
}

export async function sendRuntimeProbe(
  desk: ProbeDesk<RuntimeReachability>,
  engine: ProbePort,
  address: string,
): Promise<RuntimeReachability> {
  return sendAndWait(
    desk,
    engine,
    { kind: 'probe-runtime', id: randomUUID(), address },
    {
      subject: address,
      fold: { verdict: 'unreachable' },
      why: `recompose could not look at the runtime at ${address} within ${String(PROBE_TIMEOUT_MS)}ms.`,
    },
  );
}

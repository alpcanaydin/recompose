import type {
  EngineDirective,
  EngineReport,
  KeyCheckReport,
  KeyProviderId,
} from '@recompose/contracts';

import { randomUUID } from 'node:crypto';

export const PROBE_TIMEOUT_MS = 15_000;

type ProbeWaiter = {
  provider: KeyProviderId;
  answer: (report: KeyCheckReport) => void;
};

type ProbePort = {
  postMessage: (directive: EngineDirective) => void;
};

export type ProbeDesk = Map<string, ProbeWaiter>;

export function createProbeDesk(): ProbeDesk {
  return new Map();
}

export function answerKeyCheck(
  desk: ProbeDesk,
  report: Extract<EngineReport, { kind: 'key-check' }>,
): void {
  const waiting = desk.get(report.answers);

  if (waiting === undefined) {
    console.error(
      'recompose dropped a key-check report, because the probe it answers had already been given up on.',
    );

    return;
  }

  desk.delete(report.answers);
  waiting.answer({
    verdict: report.verdict,
    ...(report.status === undefined ? {} : { status: report.status }),
  });
}

export function foldEveryProbe(desk: ProbeDesk, why: (provider: KeyProviderId) => string): void {
  const waiting = [...desk.values()];

  desk.clear();

  for (const waiter of waiting) {
    console.error(why(waiter.provider));
    waiter.answer({ verdict: 'could-not-check' });
  }
}

export async function sendProbe(
  desk: ProbeDesk,
  engine: ProbePort,
  provider: KeyProviderId,
  key: string,
): Promise<KeyCheckReport> {
  const id = randomUUID();

  return new Promise<KeyCheckReport>((answer) => {
    const giveUp = setTimeout(() => {
      desk.delete(id);
      console.error(
        `recompose could not check the ${provider} key within ${String(PROBE_TIMEOUT_MS)}ms.`,
      );
      answer({ verdict: 'could-not-check' });
    }, PROBE_TIMEOUT_MS);

    desk.set(id, {
      provider,
      answer: (report) => {
        clearTimeout(giveUp);
        answer(report);
      },
    });

    engine.postMessage({ kind: 'probe', id, provider, key });
  });
}

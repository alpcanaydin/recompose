import type { EngineReport, EngineStates } from '@recompose/contracts';

export function allStopped(slugs: readonly string[]): EngineStates {
  return Object.fromEntries(slugs.map((slug) => [slug, { status: 'stopped' as const }]));
}

export function foldEngineReport(
  states: EngineStates,
  report: Extract<EngineReport, { kind: 'state' }>,
): EngineStates {
  return { ...states, [report.slug]: report.state };
}

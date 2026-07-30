import { fc, test } from '@fast-check/vitest';
import { type EngineReport, type GatewayEngineState } from '@recompose/contracts';
import { describe, expect } from 'vitest';

import { allStopped, foldEngineReport } from './engine-state-ledger';

const anySlug = fc.constantFrom('codex', 'gemini', 'personal', 'work');
const anyState: fc.Arbitrary<GatewayEngineState> = fc.oneof(
  fc.constant<GatewayEngineState>({ status: 'running' }),
  fc.constant<GatewayEngineState>({ status: 'stopped' }),
  fc
    .integer({ min: 1024, max: 65535 })
    .map((port) => ({ status: 'stopped' as const, failure: { port } })),
);
const anyReport: fc.Arbitrary<EngineReport> = fc.record({
  kind: fc.constant('state' as const),
  slug: anySlug,
  state: anyState,
});

function report(slug: string, state: GatewayEngineState): EngineReport {
  return { kind: 'state', slug, state };
}

describe('the ledger a boot starts from', () => {
  test('every stored gateway begins stopped, because nothing serves before a start', () => {
    expect(allStopped(['codex', 'gemini'])).toEqual({
      codex: { status: 'stopped' },
      gemini: { status: 'stopped' },
    });
  });

  test('no stored gateway leaves an empty ledger', () => {
    expect(allStopped([])).toEqual({});
  });
});

describe('folding a report into the ledger', () => {
  test('a report moves its own gateway and leaves the others where they stood', () => {
    const folded = foldEngineReport(
      allStopped(['codex', 'gemini']),
      report('codex', {
        status: 'running',
      }),
    );

    expect(folded).toEqual({ codex: { status: 'running' }, gemini: { status: 'stopped' } });
  });

  test('a gateway created after boot joins the ledger on its first report', () => {
    const folded = foldEngineReport(allStopped(['codex']), report('gemini', { status: 'running' }));

    expect(folded).toEqual({ codex: { status: 'stopped' }, gemini: { status: 'running' } });
  });

  test('a failed start carries the port it wanted into the ledger', () => {
    const folded = foldEngineReport(
      allStopped(['codex']),
      report('codex', { status: 'stopped', failure: { port: 8397 } }),
    );

    expect(folded).toEqual({ codex: { status: 'stopped', failure: { port: 8397 } } });
  });

  test('the ledger it folded from keeps the state it had, so no subscriber reads a mutation', () => {
    const before = allStopped(['codex']);

    foldEngineReport(before, report('codex', { status: 'running' }));

    expect(before).toEqual({ codex: { status: 'stopped' } });
  });
});

describe('folding a run of reports', () => {
  test('interleaved reports leave each gateway on its own last word', () => {
    const folded = [
      report('codex', { status: 'running' }),
      report('gemini', { status: 'running' }),
      report('codex', { status: 'stopped', failure: { port: 8397 } }),
      report('gemini', { status: 'stopped' }),
      report('codex', { status: 'running' }),
    ].reduce(foldEngineReport, {});

    expect(folded).toEqual({ codex: { status: 'running' }, gemini: { status: 'stopped' } });
  });

  test.prop([fc.array(anyReport, { minLength: 1 })])(
    'any run of reports leaves exactly the last state each gateway reported',
    (reports) => {
      const folded = reports.reduce(foldEngineReport, {});

      for (const slug of new Set(reports.map((one) => one.slug))) {
        const last = reports.filter((one) => one.slug === slug).at(-1);

        expect(folded[slug]).toEqual(last?.state);
      }
    },
  );

  test.prop([fc.array(anyReport)])('the ledger names no gateway that never reported', (reports) => {
    const folded = reports.reduce(foldEngineReport, {});

    expect(Object.keys(folded).sort()).toEqual([...new Set(reports.map((one) => one.slug))].sort());
  });
});

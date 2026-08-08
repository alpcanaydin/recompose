import { describe, expect, test } from 'vitest';

import { claudeBetas, requestedClaudeBetas } from './claude-betas';

function betasFor(body: Record<string, unknown>): string[] {
  return claudeBetas(body, requestedClaudeBetas(body)).split(',');
}

describe('reading the beta flags a Claude request asks for', () => {
  test('a request without a betas field asks for nothing', () => {
    expect([...requestedClaudeBetas({})]).toEqual([]);
  });

  test('only the string entries of the betas field count', () => {
    expect([...requestedClaudeBetas({ betas: ['fallback-credit-2026-06-01', 7] })]).toEqual([
      'fallback-credit-2026-06-01',
    ]);
  });
});

describe('choosing the beta flags for a Claude subscription request', () => {
  test('a long-context model asks for the one-million-token window', () => {
    expect(betasFor({ model: 'claude-sonnet-4-5[1m]' })).toContain('context-1m-2025-08-07');
  });

  test('a model without the long-context marker leaves that window alone', () => {
    expect(betasFor({ model: 'claude-sonnet-4-5' })).not.toContain('context-1m-2025-08-07');
  });

  test('a request naming no model leaves the long-context window alone', () => {
    expect(betasFor({})).not.toContain('context-1m-2025-08-07');
  });

  test('a request asking for fast mode says so', () => {
    expect(betasFor({ speed: 'fast' })).toContain('fast-mode-2026-02-01');
  });

  test('a request that carries diagnostics asks for cache diagnosis', () => {
    expect(betasFor({ diagnostics: { cache: true } })).toContain('cache-diagnosis-2026-04-07');
  });

  test('a request declaring tools asks for advanced tool use', () => {
    expect(betasFor({ tools: [{ name: 'Read' }] })).toContain('advanced-tool-use-2025-11-20');
  });

  test('a request declaring an empty tool list leaves advanced tool use alone', () => {
    expect(betasFor({ tools: [] })).not.toContain('advanced-tool-use-2025-11-20');
  });
});

describe('deciding whether Claude may redact its thinking', () => {
  test('a request that displays thinking keeps the thinking visible', () => {
    expect(betasFor({ thinking: { display: 'expanded' } })).not.toContain(
      'redact-thinking-2026-02-12',
    );
  });

  test('a blank display setting counts as no display', () => {
    expect(betasFor({ thinking: { display: '  ' } })).toContain('redact-thinking-2026-02-12');
  });

  test('a thinking setting that is not an object counts as no display', () => {
    expect(betasFor({ thinking: 'enabled' })).toContain('redact-thinking-2026-02-12');
  });
});

describe('honouring the fallback betas the caller already asked for', () => {
  test('a caller that never mentions fallback credit gets it once', () => {
    expect(betasFor({}).filter((beta) => beta === 'fallback-credit-2026-06-01')).toHaveLength(1);
  });

  test('a caller that asked for fallback credit gets it echoed once', () => {
    const betas = betasFor({ betas: ['fallback-credit-2026-06-01'] });

    expect(betas.filter((beta) => beta === 'fallback-credit-2026-06-01')).toHaveLength(1);
  });

  test('the other fallback betas travel only when the caller asked for them', () => {
    const asked = betasFor({ betas: ['server-side-fallback-2026-06-01'] });

    expect(asked).toContain('server-side-fallback-2026-06-01');
    expect(betasFor({})).not.toContain('server-side-fallback-2026-06-01');
  });

  test('a caller asking for structured outputs has that echoed', () => {
    expect(betasFor({ betas: ['structured-outputs-2025-12-15'] })).toContain(
      'structured-outputs-2025-12-15',
    );
  });
});

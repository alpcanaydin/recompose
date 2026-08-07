import { describe, expect, test } from 'vitest';

import { kimiProviderBody, normalizeKimiUpstreamModel } from './kimi-request';

describe('normalizeKimiUpstreamModel', () => {
  test.each([
    ['kimi-k3[1m]', 'k3'],
    ['kimi-k3', 'k3'],
    ['Kimi-K3[1M]', 'k3'],
    ['k3[1m]', 'k3'],
    ['k3', 'k3'],
    ['kimi-k2.6', 'k2.6'],
    ['kimi-k2.6[1m]', 'k2.6'],
    ['kimi-k3(1024)', 'k3(1024)'],
    ['kimi-k3[1m](1024)', 'k3(1024)'],
    ['kimi-k2.6(high)', 'k2.6(high)'],
    ['kimi-k2.6[1m](high)', 'k2.6(high)'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeKimiUpstreamModel(input)).toBe(expected);
  });
});

describe('kimiProviderBody', () => {
  test('keeps Claude max semantics while sending the canonical model', () => {
    expect(kimiProviderBody({ messages: [] }, 'kimi-k2.5(max)', 'anthropic')).toEqual({
      model: 'k2.5',
      messages: [],
      output_config: { effort: 'high' },
    });
  });

  test('uses native Kimi thinking fields for Chat Completions', () => {
    expect(kimiProviderBody({ messages: [] }, 'kimi-k3[1m](medium)', 'chat-completions')).toEqual({
      model: 'k3',
      messages: [],
      thinking: { type: 'enabled', effort: 'medium' },
    });
  });
});

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

describe('a Kimi model that names no reasoning level', () => {
  test.each([
    ['no suffix at all', 'kimi-k2.6', 'k2.6'],
    ['a context suffix rather than a level', 'kimi-k3(1024)', 'k3'],
    ['a level Kimi does not answer to', 'kimi-k3(blistering)', 'k3'],
  ])('%s leaves the Claude effort field untouched', (_name, requested, sent) => {
    expect(kimiProviderBody({ messages: [] }, requested, 'anthropic')).toEqual({
      model: sent,
      messages: [],
    });
  });

  test('a context suffix leaves the Chat Completions thinking field untouched', () => {
    expect(kimiProviderBody({ messages: [] }, 'kimi-k3(1024)', 'chat-completions')).toEqual({
      model: 'k3',
      messages: [],
    });
  });
});

describe('the effort a Kimi request already carries', () => {
  test('an output config the caller sent keeps its own fields beside the effort', () => {
    const body = { messages: [], output_config: { verbosity: 'high' } };

    expect(kimiProviderBody(body, 'kimi-k2.5(max)', 'anthropic')).toEqual({
      model: 'k2.5',
      messages: [],
      output_config: { verbosity: 'high', effort: 'high' },
    });
  });

  test('a thinking block the caller sent keeps its own fields beside the effort', () => {
    const body = { messages: [], thinking: { budget_tokens: 2048 } };

    expect(kimiProviderBody(body, 'kimi-k3(medium)', 'chat-completions')).toEqual({
      model: 'k3',
      messages: [],
      thinking: { budget_tokens: 2048, type: 'enabled', effort: 'medium' },
    });
  });

  test('an output config that is not an object is replaced outright', () => {
    const body = { messages: [], output_config: 'eager' };

    expect(kimiProviderBody(body, 'kimi-k2.5(max)', 'anthropic')).toEqual({
      model: 'k2.5',
      messages: [],
      output_config: { effort: 'high' },
    });
  });

  test('a thinking field that is not an object is replaced outright', () => {
    const body = { messages: [], thinking: true };

    expect(kimiProviderBody(body, 'kimi-k3(medium)', 'chat-completions')).toEqual({
      model: 'k3',
      messages: [],
      thinking: { type: 'enabled', effort: 'medium' },
    });
  });
});

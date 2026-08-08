import { describe, expect, test } from 'vitest';

import { normalizeXAIToolChoice, xaiProviderBody } from './xai-request';

describe('normalizeXAIToolChoice', () => {
  test.each([
    { tools: [], tool_choice: 'auto', parallel_tool_calls: true, input: 'hi' },
    { tool_choice: 'auto', input: 'hi' },
    { parallel_tool_calls: true, input: 'hi' },
  ])('drops orphaned tool controls for %j', (body) => {
    expect(normalizeXAIToolChoice(body)).toEqual({ input: 'hi' });
  });

  test('keeps controls when top-level tools exist', () => {
    const body = {
      tools: [{ type: 'function', name: 'lookup' }],
      tool_choice: 'auto',
      parallel_tool_calls: true,
    };

    expect(normalizeXAIToolChoice(body)).toBe(body);
  });

  test('keeps controls when additional_tools input exists', () => {
    const body = {
      input: [{ type: 'additional_tools', tools: [{ type: 'function', name: 'lookup' }] }],
      tool_choice: 'auto',
      parallel_tool_calls: true,
    };

    expect(normalizeXAIToolChoice(body)).toBe(body);
  });

  test('returns the original request when no tool controls exist', () => {
    const body = { model: 'grok-4', input: 'hi' };

    expect(normalizeXAIToolChoice(body)).toBe(body);
  });
});

test('xaiProviderBody forces streaming and carries the execution session', () => {
  const crossing = {
    dialect: 'responses' as const,
    raw: {},
    gatewayName: 'Test',
    virtualModel: 'fast',
    providerModel: 'grok-4.3',
    sessionId: 'conv-xai-1',
  };

  expect(xaiProviderBody({ input: 'hello', stop: ['done'] }, crossing)).toEqual({
    model: 'grok-4.3',
    input: 'hello',
    stream: true,
    prompt_cache_key: 'conv-xai-1',
  });
});

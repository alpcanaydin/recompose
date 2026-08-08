import { describe, expect, it } from 'vitest';

import type { AnthropicRequest } from '../dialect/anthropic-wire';

import { translateRequestToGemini } from '../dialect/gemini-bridge';
import { antigravityProviderRequest } from './antigravity-request';

const HINT = 'Interleaved thinking is enabled.';
const MODEL = 'claude-sonnet-4-5-thinking';
const credential = {
  accessToken: 'google-access',
  refreshToken: 'google-refresh',
  projectId: 'cloud-project',
};

describe('Antigravity interleaved-thinking hint parity', () => {
  it('should append the hint when tools and thinking are active', () => {
    const body = providerBody(request({ system: 'You are helpful.', tools: [weatherTool()] }));

    expect(JSON.stringify(body)).toContain('You are helpful.');
    expect(JSON.stringify(body)).toContain(HINT);
  });

  it('should create a system instruction when none exists', () => {
    const body = providerBody(request({ tools: [weatherTool()] }));

    expect(body).toHaveProperty('request.systemInstruction.role', 'user');
    expect(JSON.stringify(body)).toContain(HINT);
  });

  it('should omit the hint when thinking is disabled', () => {
    const body = providerBody(request({ tools: [weatherTool()] }, false));

    expect(JSON.stringify(body)).not.toContain(HINT);
  });

  it('should omit the hint when no tools are declared', () => {
    const body = providerBody(request({}));

    expect(JSON.stringify(body)).not.toContain(HINT);
  });
});

function request(
  fields: Partial<Pick<AnthropicRequest, 'system' | 'thinking' | 'tools'>>,
  thinkingEnabled = true,
): AnthropicRequest {
  return {
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: 'Hello' }],
    ...(thinkingEnabled ? { thinking: { type: 'enabled', budget_tokens: 8000 } } : {}),
    ...fields,
  };
}

function weatherTool() {
  return {
    name: 'get_weather',
    description: 'Get weather',
    input_schema: {
      type: 'object',
      properties: { location: { type: 'string' } },
    },
  };
}

function providerBody(source: AnthropicRequest): unknown {
  const translated = translateRequestToGemini('anthropic', source);

  if ('refusal' in translated) throw new Error('expected translated Antigravity request');

  const provider = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    { ...translated.value, model: MODEL },
    credential,
    { requestId: 'req-1', sessionId: 'session-1' },
    1_800_000_000_000,
  );

  return JSON.parse(provider.body);
}

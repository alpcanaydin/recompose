import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { parsedJson } from '../gateway-wire';
import { claudeProviderRequest } from './claude-request';

const ids = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

function sentBody(rawBody: JsonObject): unknown {
  const request = claudeProviderRequest(
    'https://api.anthropic.com',
    rawBody,
    'claude-access',
    ids,
    undefined,
    1_700_000_000_000,
  );

  return parsedJson(request.body);
}

describe('shaping a Claude request that forces a tool', () => {
  it('should drop the thinking directive a forced tool cannot honour', () => {
    const body = sentBody({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hello' }],
      tool_choice: { type: 'any' },
      thinking: { type: 'enabled', budget_tokens: 2000 },
    });

    expect(body).not.toHaveProperty('thinking');
  });

  it('should keep the output settings that outlive the dropped effort', () => {
    const body = sentBody({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hello' }],
      tool_choice: { type: 'tool', name: 'Bash' },
      output_config: { effort: 'high', verbosity: 'low' },
    });

    expect(body).toHaveProperty('output_config', { verbosity: 'low' });
  });
});

describe('shaping the cache breakpoints of a Claude request', () => {
  it('should shorten a one-hour breakpoint that follows a five-minute one', () => {
    const body = sentBody({
      model: 'claude-sonnet-4-5',
      tools: [
        {
          name: 'Bash',
          input_schema: { type: 'object', properties: {} },
          cache_control: { type: 'ephemeral' },
        },
        {
          name: 'Read',
          input_schema: { type: 'object', properties: {} },
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(JSON.stringify(body)).not.toContain('"ttl":"1h"');
  });

  it('should ignore a message entry that is not an object', () => {
    const body = sentBody({
      model: 'claude-sonnet-4-5',
      messages: ['stray', { role: 'user', content: 'hello' }],
    });

    expect(body).toHaveProperty('messages.1.role', 'user');
  });
});

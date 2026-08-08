import { describe, expect, it } from 'vitest';

import { isJsonObject } from '../gateway-wire';
import { codexProviderRequest } from './codex-request';

describe('Responses roles normalized for Codex', () => {
  it('should convert every system role to developer and preserve other roles', () => {
    const body = normalized({
      input: [
        { type: 'message', role: 'system', content: 'one' },
        { type: 'message', role: 'system', content: 'two' },
        { type: 'message', role: 'user', content: 'hello' },
        { type: 'message', role: 'assistant', content: 'hi' },
      ],
    });

    expect(body['input']).toMatchObject([
      { role: 'developer', content: 'one' },
      { role: 'developer', content: 'two' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
  });

  it('should leave requests without system roles unchanged', () => {
    const input = [
      { type: 'message', role: 'user', content: 'hello' },
      { type: 'message', role: 'assistant', content: 'hi' },
    ];

    expect(normalized({ input })['input']).toEqual(input);
  });

  it('should accept empty or missing input while enforcing Codex controls', () => {
    expect(normalized({ input: [] })).toMatchObject({ input: [], stream: true, store: false });
    expect(normalized({ stream: false })).toMatchObject({ stream: true, store: false });
  });
});

describe('Responses required fields normalized for Codex', () => {
  it('should enforce the streaming, storage, parallel, and reasoning include controls', () => {
    expect(
      normalized({
        input: [{ type: 'message', role: 'system', content: 'hello' }],
        stream: false,
        store: true,
      }),
    ).toMatchObject({
      input: [{ role: 'developer', content: 'hello' }],
      stream: true,
      store: false,
      parallel_tool_calls: true,
      include: ['reasoning.encrypted_content'],
    });
  });

  it('should remove unsupported sampling, ownership, compaction, and truncation fields', () => {
    const body = normalized({
      input: [{ type: 'message', role: 'system', content: 'hello' }],
      max_output_tokens: 4096,
      max_completion_tokens: 4096,
      temperature: 0.2,
      top_p: 0.9,
      service_tier: 'standard',
      truncation: 'auto',
      user: 'request-owner',
      context_management: [{ type: 'compaction', compact_threshold: 12_000 }],
    });

    for (const field of [
      'max_output_tokens',
      'max_completion_tokens',
      'temperature',
      'top_p',
      'service_tier',
      'truncation',
      'user',
      'context_management',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });
});

describe('Responses web-search aliases normalized for Codex', () => {
  it('should normalize preview aliases in tools and allowed tool choices', () => {
    const body = normalized({
      input: 'find latest model news',
      tools: [{ type: 'web_search_preview_2025_03_11' }],
      tool_choice: {
        type: 'allowed_tools',
        tools: [{ type: 'web_search_preview' }, { type: 'web_search_preview_2025_03_11' }],
      },
    });

    const tools = body['tools'];

    if (!Array.isArray(tools)) throw new Error('expected Codex tools');

    expect(tools).toContainEqual(expect.objectContaining({ type: 'web_search' }));
    expect(body['tool_choice']).toEqual({
      type: 'allowed_tools',
      tools: [{ type: 'web_search' }, { type: 'web_search' }],
    });
  });

  it('should normalize a top-level preview tool choice alias', () => {
    expect(
      normalized({ input: 'find news', tool_choice: { type: 'web_search_preview_2025_03_11' } }),
    ).toHaveProperty('tool_choice.type', 'web_search');
  });
});

function normalized(fields: Record<string, unknown>): Record<string, unknown> {
  const request = codexProviderRequest(
    'https://chatgpt.com/backend-api/codex',
    { model: 'gpt-5.6', ...fields },
    { accessToken: 'codex-access' },
    'session-1',
  );
  const body: unknown = JSON.parse(request.body);

  if (!isJsonObject(body)) throw new Error('expected Codex request body');

  return body;
}

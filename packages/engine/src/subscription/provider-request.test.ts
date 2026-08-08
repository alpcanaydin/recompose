import { describe, expect, test } from 'vitest';

import { isJsonObject } from '../gateway-wire';
import { codexProviderRequest } from './codex-request';

const ids = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
};

const imageTool = { type: 'image_generation', output_format: 'png' };

const codexHeaders: [string, string][] = [
  ['Content-Type', 'application/json'],
  ['Authorization', 'Bearer codex-access'],
  ['User-Agent', 'codex-tui/0.146.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.146.0)'],
  ['Session_id', ids.sessionId],
  ['Accept', 'text/event-stream'],
  ['Connection', 'Keep-Alive'],
  ['Originator', 'codex-tui'],
  ['Chatgpt-Account-Id', 'acct-work'],
];

function objectBodyOf(request: { body: string }): Record<string, unknown> {
  const body: unknown = JSON.parse(request.body);

  if (!isJsonObject(body)) {
    throw new Error('expected an object request body');
  }

  return body;
}

function itemIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    const id = isJsonObject(entry) ? entry['id'] : undefined;

    return typeof id === 'string' ? [id] : [];
  });
}

describe('the request sent as Codex TUI 0.146.0', () => {
  test('the Codex Responses endpoint receives a streaming request with account identity', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.4',
        instructions: null,
        input: [{ type: 'message', role: 'user', content: 'hello' }],
        store: true,
        previous_response_id: 'resp-old',
        stream_options: { include_usage: true },
      },
      { accessToken: 'codex-access', accountId: 'acct-work' },
      ids.sessionId,
    );

    expect(request.url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(JSON.parse(request.body)).toEqual({
      model: 'gpt-5.4',
      instructions: '',
      input: [{ type: 'message', role: 'user', content: 'hello' }],
      store: false,
      stream: true,
      prompt_cache_key: ids.sessionId,
      include: ['reasoning.encrypted_content'],
      tools: [imageTool],
      parallel_tool_calls: true,
    });
    expect(request.headers).toEqual(codexHeaders);
  });

  test('Codex omits the account header when the native bundle carries none', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      { model: 'gpt-5.4', input: [] },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(request.headers.map(([name]) => name)).not.toContain('Chatgpt-Account-Id');
  });
});

describe('normalizing a request for Codex compatibility', () => {
  test('the Codex-required body fields override unsupported client values', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        stream: 'true',
        store: true,
        parallel_tool_calls: 'false',
        include: ['file_search_call.results', 'reasoning.encrypted_content'],
        max_output_tokens: 4096,
        max_completion_tokens: 4096,
        temperature: 0.2,
        top_p: 0.9,
        service_tier: 'standard',
        truncation: 'auto',
        user: 'request-owner',
        context_management: [{ type: 'compaction', compact_threshold: 12_000 }],
        input: [{ type: 'message', role: 'system', content: 'hello' }],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toEqual({
      model: 'gpt-5.6',
      stream: true,
      store: false,
      prompt_cache_key: ids.sessionId,
      include: ['reasoning.encrypted_content'],
      instructions: '',
      input: [{ type: 'message', role: 'developer', content: 'hello' }],
      tools: [imageTool],
      parallel_tool_calls: true,
    });
  });
});

describe('normalizing optional Codex request fields', () => {
  test('Codex keeps the only supported service tier', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      { model: 'gpt-5.6', service_tier: 'priority', input: [] },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({ service_tier: 'priority' });
  });

  test('Codex normalizes string input and web-search aliases', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        input: 'find current model news',
        tools: [{ type: 'web_search_preview_2025_03_11' }],
        tool_choice: {
          type: 'allowed_tools',
          tools: [{ type: 'web_search_preview' }, { type: 'web_search_preview_2025_03_11' }],
        },
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'find current model news' }],
        },
      ],
      tools: [{ type: 'web_search' }, imageTool],
      tool_choice: {
        type: 'allowed_tools',
        tools: [{ type: 'web_search' }, { type: 'web_search' }],
      },
    });
  });
});

describe('sanitizing Codex Responses input identity', () => {
  test('overlong encrypted reasoning is dropped and other item ids are bounded', () => {
    const longCallId = 'grok-call-item-'.repeat(6);
    const longOutputId = 'grok-output-item-'.repeat(6);
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.4',
        input: [
          { type: 'reasoning', id: `rs_${'a'.repeat(64)}`, encrypted_content: 'opaque' },
          { type: 'function_call', id: longCallId, call_id: 'call-1', name: 'lookup' },
          { type: 'function_call_output', id: longOutputId, call_id: 'call-1', output: 'ok' },
          { type: 'message', id: 'item_74ec40c883248ebb4885ec84', role: 'user' },
        ],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );
    const body = objectBodyOf(request);
    const input = body['input'];

    expect(input).toHaveLength(3);
    expect(input).toMatchObject([
      { type: 'function_call', call_id: 'call-1' },
      { type: 'function_call_output', call_id: 'call-1' },
      { type: 'message', id: 'msg_item_74ec40c883248ebb4885ec84' },
    ]);
    const text = JSON.stringify(body);

    expect(text).not.toContain('"type":"reasoning"');
    expect(text).not.toContain(longCallId);
    expect(text).not.toContain(longOutputId);
    expect(itemIds(input).every((id) => Array.from(id).length <= 64)).toBe(true);
  });
});

describe('normalizing Codex parallel tool calls', () => {
  test.each([
    [{}, true],
    [{ tools: [], parallel_tool_calls: false }, false],
    [{ tools: [{ type: 'function', name: 'lookup' }], parallel_tool_calls: true }, true],
  ])('matches tool availability for %j', (fields, expected) => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      { model: 'gpt-5.4', input: [], parallel_tool_calls: true, ...fields },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );
    const body = objectBodyOf(request);

    expect(body['parallel_tool_calls']).toBe(expected);
  });

  test('responses-lite forces parallel tool calls off', () => {
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6-luna',
        tools: [{ type: 'function', name: 'lookup' }],
        parallel_tool_calls: true,
        client_metadata: {
          ws_request_header_x_openai_internal_codex_responses_lite: 'true',
        },
        input: [],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({ parallel_tool_calls: false });
  });
});

describe('bounding Codex tool identities', () => {
  test('Codex shortens a long call id consistently across the call and its output', () => {
    const longId = `toolu_${'a'.repeat(62)}`;
    const boundedId = 'toolu_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_6eedd4aa88a6ed2f';
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        input: [
          { type: 'function_call', call_id: longId, name: 'Bash', arguments: '{}' },
          { type: 'function_call_output', call_id: longId, output: 'ok' },
        ],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({
      input: [{ call_id: boundedId }, { call_id: boundedId }],
    });
    expect(boundedId).not.toBe(longId);
    expect(boundedId).toHaveLength(64);
  });

  test('Codex gives long tool declarations, choices, and calls the same bounded name', () => {
    const longName = 'mcp__server_with_a_very_long_name_that_exceeds_sixty_four_characters__search';
    const request = codexProviderRequest(
      'https://chatgpt.com/backend-api/codex',
      {
        model: 'gpt-5.6',
        tools: [{ type: 'function', name: longName, parameters: { type: 'object' } }],
        tool_choice: { type: 'function', name: longName },
        input: [{ type: 'function_call', call_id: 'call_1', name: longName, arguments: '{}' }],
      },
      { accessToken: 'codex-access' },
      ids.sessionId,
    );

    expect(JSON.parse(request.body)).toMatchObject({
      tools: [{ name: 'mcp__search' }, imageTool],
      tool_choice: { name: 'mcp__search' },
      input: [{ name: 'mcp__search' }],
    });
  });
});

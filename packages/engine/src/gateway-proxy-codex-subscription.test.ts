import { describe, expect, test } from 'vitest';

import {
  codexSse as sseFor,
  codexSubscriptionApp as codexApp,
} from './gateway-proxy-codex-subscription.testkit';
import { chatRequest } from './gateway-proxy-subscription.testkit';

const completed = {
  type: 'response.completed',
  response: {
    id: 'resp_1',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'hello back' }],
      },
    ],
    usage: { input_tokens: 3, output_tokens: 2 },
  },
};

const streamEvents = [
  { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', output: [] } },
  {
    type: 'response.output_item.added',
    output_index: 0,
    item: { type: 'message', role: 'assistant' },
  },
  { type: 'response.output_text.delta', output_index: 0, delta: 'hello back' },
  { type: 'response.output_item.done', output_index: 0 },
  { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [] } },
];

describe('serving a Codex subscription target', () => {
  test('a non-streaming Anthropic request consumes Codex SSE into one Messages document', async () => {
    const { app, provider } = codexApp(() => sseFor([completed]));
    const answer = await app.request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        max_tokens: 64,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.request.url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(JSON.parse(provider.sent[0]?.request.body ?? '{}')).toMatchObject({
      model: 'claude-sonnet-4-5',
      store: false,
      stream: true,
    });
    expect(answer.headers.get('content-type')).toContain('application/json');
    expect(await answer.json()).toMatchObject({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'hello back' }],
    });
  });

  test('a streaming Chat Completions request translates each Codex Responses event', async () => {
    const { app } = codexApp(() => sseFor(streamEvents));
    const answer = await chatRequest(app, true);
    const text = await answer.text();

    expect(answer.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('"content":"hello back"');
    expect(text).toContain('data: [DONE]');
  });
});

describe('preserving Codex subscription request controls', () => {
  test('an Anthropic parallel-tool opt-out reaches Codex', async () => {
    const { app, provider } = codexApp(() => sseFor([completed]));

    await app.request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        max_tokens: 64,
        messages: [{ role: 'user', content: 'hello' }],
        tools: [
          {
            name: 'read',
            description: 'Read a file',
            input_schema: { type: 'object', properties: {} },
          },
        ],
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      }),
    });

    expect(JSON.parse(provider.sent[0]?.request.body ?? '{}')).toMatchObject({
      parallel_tool_calls: false,
    });
  });
});

describe('carrying Claude documents to a Codex subscription', () => {
  test('a base64 PDF becomes a Codex input_file without losing surrounding text', async () => {
    const { app, provider } = codexApp(() => sseFor([completed]));

    await app.request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        max_tokens: 64,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'before' },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: 'JVBERi0xLjQK',
                },
              },
              { type: 'text', text: 'after' },
            ],
          },
        ],
      }),
    });

    expect(JSON.parse(provider.sent[0]?.request.body ?? '{}')).toMatchObject({
      input: [
        {
          content: [
            { type: 'input_text', text: 'before' },
            {
              type: 'input_file',
              file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
              filename: 'document.pdf',
            },
            { type: 'input_text', text: 'after' },
          ],
        },
      ],
    });
  });
});

describe('normalizing Codex subscription failures', () => {
  test('a usage limit becomes 429 with its provider reset delay', async () => {
    const { app } = codexApp(() =>
      Response.json(
        {
          error: {
            type: 'usage_limit_reached',
            message: 'usage exhausted',
            resets_in_seconds: 120,
          },
        },
        { status: 400 },
      ),
    );

    const answer = await chatRequest(app);

    expect(answer.status).toBe(429);
    expect(answer.headers.get('retry-after')).toBe('120');
    await expect(answer.json()).resolves.toMatchObject({
      error: { type: 'usage_limit_reached', message: 'usage exhausted' },
    });
  });

  test('a context failure receives the stable Codex error code', async () => {
    const { app } = codexApp(() =>
      Response.json(
        {
          error: {
            type: 'invalid_request_error',
            code: 'context_length_exceeded',
            message: 'context length exceeded',
          },
        },
        { status: 413 },
      ),
    );

    const answer = await chatRequest(app);

    expect(answer.status).toBe(413);
    await expect(answer.json()).resolves.toEqual({
      error: {
        message: 'context length exceeded',
        type: 'invalid_request_error',
        code: 'context_too_large',
      },
    });
  });
});

describe('normalizing Codex terminal SSE failures', () => {
  test('a terminal SSE context error becomes a failed HTTP response', async () => {
    const { app } = codexApp(() =>
      sseFor([
        {
          type: 'error',
          error: {
            type: 'invalid_request_error',
            code: 'context_length_exceeded',
            message: 'Your input exceeds the context window',
          },
        },
      ]),
    );

    const answer = await chatRequest(app);

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toMatchObject({
      error: { type: 'invalid_request_error', code: 'context_too_large' },
    });
  });

  test('a terminal SSE usage limit becomes 429 with Retry-After', async () => {
    const { app } = codexApp(() =>
      sseFor([
        {
          type: 'response.failed',
          response: {
            id: 'resp_failed',
            status: 'failed',
            output: [],
            error: {
              type: 'usage_limit_reached',
              message: 'usage limit reached',
              resets_in_seconds: 60,
            },
          },
        },
      ]),
    );

    const answer = await chatRequest(app);

    expect(answer.status).toBe(429);
    expect(answer.headers.get('retry-after')).toBe('60');
    await expect(answer.json()).resolves.toMatchObject({
      error: { type: 'usage_limit_reached', message: 'usage limit reached' },
    });
  });
});

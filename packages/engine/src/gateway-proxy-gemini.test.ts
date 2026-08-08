import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aCredentialedGrant, aGatewayHolding, aVirtualModel } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

const grant = aCredentialedGrant('https://generativelanguage.googleapis.com', 'gemini');

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;

  return input instanceof URL ? input.href : input.url;
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  const body = typeof init?.body === 'string' ? parsedJson(init.body) : undefined;

  return isJsonObject(body) ? body : {};
}

function geminiResponse(): Response {
  return Response.json({
    candidates: [
      {
        content: { role: 'model', parts: [{ text: 'selam' }] },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
  });
}

function geminiStream(): Response {
  const frames = [
    { candidates: [{ content: { role: 'model', parts: [{ text: 'se' }] } }] },
    {
      candidates: [{ content: { role: 'model', parts: [{ text: 'lam' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    },
  ];
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('');

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function ask(fetchLike: typeof fetch, stream = false): Promise<Response> {
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(grant),
    fetchLike,
  );

  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
      stream,
    }),
  });
}

describe('Gemini provider serving', () => {
  test('translates a generateContent answer back to Chat Completions', async () => {
    const answer = await ask(async () => Promise.resolve(geminiResponse()));
    const body: unknown = await answer.json();

    expect(body).toMatchObject({
      choices: [{ message: { role: 'assistant', content: 'selam' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
  });

  test('translates generateContent SSE and terminates the chat stream', async () => {
    const answer = await ask(async () => Promise.resolve(geminiStream()), true);
    const body = await answer.text();

    expect(body).toContain('"content":"se"');
    expect(body).toContain('"content":"lam"');
    expect(body).toContain('data: [DONE]');
  });

  test('uses native countTokens for an Anthropic count request', async () => {
    const sent: string[] = [];
    const fetchLike: typeof fetch = async (input) => {
      sent.push(urlOf(input));

      return Promise.resolve(Response.json({ totalTokens: 17 }));
    };
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(grant),
      fetchLike,
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', messages: [{ role: 'user', content: 'hello' }] }),
    });

    expect(sent).toEqual([
      'https://generativelanguage.googleapis.com/v1beta/models/gpt-5-mini:countTokens',
    ]);
    expect(await answer.json()).toEqual({ input_tokens: 17 });
  });
});

describe('Gemini provider output limits', () => {
  test('caps maxOutputTokens before reaching a known Gemini model', async () => {
    const sent: Record<string, unknown>[] = [];
    const fetchLike: typeof fetch = async (_input, init) => {
      sent.push(bodyOf(init));

      return Promise.resolve(geminiResponse());
    };
    const model = aVirtualModel({
      target: { standing: 'bound', providerModel: 'gemini-3.1-pro-preview' },
    });
    const app = createGatewayApp(
      aGatewayHolding(model),
      async () => Promise.resolve(grant),
      fetchLike,
    );

    await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 500_000,
        temperature: 0.2,
      }),
    });

    expect(sent[0]).toHaveProperty('generationConfig', {
      maxOutputTokens: 65_536,
      temperature: 0.2,
    });
  });
});

describe('Gemini provider tool-name restoration', () => {
  test('restores a colliding long tool name in the client response', async () => {
    const first = 'mcp__plugin_cloudflare_cloudflare-builds__workers_builds_get_build';
    const second = 'mcp__plugin_cloudflare_cloudflare-builds__workers_builds_get_build_logs';
    let sent: Record<string, unknown> = {};
    const fetchLike: typeof fetch = async (_input, init) => {
      sent = bodyOf(init);
      const mapped = toolNameAt(sent, 1);

      return Promise.resolve(
        Response.json({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ functionCall: { id: 'call_1', name: mapped, args: {} } }],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      );
    };
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(grant),
      fetchLike,
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: 'run it' }],
        tools: [tool(first), tool(second)],
        tool_choice: { type: 'function', function: { name: second } },
      }),
    });

    expect(toolNameAt(sent, 0)).not.toBe(toolNameAt(sent, 1));
    expect(toolNameAt(sent, 0).length).toBeLessThanOrEqual(64);
    expect(toolNameAt(sent, 1).length).toBeLessThanOrEqual(64);
    await expect(answer.json()).resolves.toHaveProperty(
      'choices.0.message.tool_calls.0.function.name',
      second,
    );
  });
});

function tool(name: string) {
  return { type: 'function', function: { name, parameters: { type: 'object' } } };
}

function toolNameAt(body: Record<string, unknown>, index: number): string {
  const declaration: unknown = declarationsIn(body)[index];

  if (!isJsonObject(declaration) || typeof declaration['name'] !== 'string') {
    throw new Error('Gemini declaration name is missing');
  }

  return declaration['name'];
}

function declarationsIn(body: Record<string, unknown>): unknown[] {
  const tools = body['tools'];

  if (!Array.isArray(tools)) throw new Error('Gemini tools are missing');

  const group: unknown = tools[0];

  if (!isJsonObject(group) || !Array.isArray(group['functionDeclarations'])) {
    throw new Error('Gemini declarations are missing');
  }

  return group['functionDeclarations'];
}

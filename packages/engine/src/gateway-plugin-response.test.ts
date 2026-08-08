import { describe, expect, it } from 'vitest';

import {
  askResponseGateway,
  pluginStreamAnswer,
  responseGateway,
} from './gateway-plugin-response.testkit';
import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import {
  decodedPluginBytes,
  encodedPluginBytes,
  responseHost,
  responsePlugin,
} from './plugin-response-interceptor.testkit';

describe('gateway response plugin rewriting', () => {
  it('should rewrite a successful response with provider request context', async () => {
    const seen: Record<string, unknown>[] = [];
    const plugin = responsePlugin({ response: true }, (_method, request) => {
      seen.push(request);
      const body = parsedRecord(decodedPluginBytes(request['Body']));

      return {
        Headers: { 'x-response-plugin': ['yes'] },
        ClearHeaders: ['x-recompose-target'],
        Body: encodedPluginBytes(JSON.stringify({ ...body, plugin_marker: true })),
      };
    });
    const host = await responseHost([['response', 1, plugin]]);
    const { app } = responseGateway(host, chatAnswer);

    const answer = await askResponseGateway(app, false);

    expect(answer.headers.get('x-response-plugin')).toBe('yes');
    expect(answer.headers.has('x-recompose-target')).toBe(false);
    await expect(answer.json()).resolves.toMatchObject({ plugin_marker: true });
    expect(seen[0]?.['SourceFormat']).toBe('chat-completions');
    expect(headerValue(seen[0]?.['RequestHeaders'], 'authorization')).toBe('Bearer sk-live-40d1');
    expect(parsedPluginBody(seen[0]?.['RequestBody'])).toMatchObject({ model: 'gpt-5-mini' });
    expect(parsedPluginBody(seen[0]?.['OriginalRequest'])).toMatchObject({ model: 'fast' });
  });

  it('should skip unsuccessful provider responses', async () => {
    const plugin = responsePlugin({ response: true }, () => ({
      Body: encodedPluginBytes('should-not-run'),
    }));
    const host = await responseHost([['response', 1, plugin]]);
    const { app } = responseGateway(host, () =>
      Response.json({ error: 'upstream' }, { status: 502 }),
    );

    const answer = await askResponseGateway(app, false);

    expect(answer.status).toBe(502);
    expect(plugin.methods).not.toContain(pluginMethods.responseInterceptAfter);
  });
});

describe('gateway response context after authentication', () => {
  it('should expose the after-auth body as executed request context', async () => {
    let responseContext: Record<string, unknown> | undefined;
    const plugin = responsePlugin({ request: true, response: true }, (method, request) => {
      if (method === pluginMethods.requestInterceptBefore) return {};

      if (method === pluginMethods.requestInterceptAfter) {
        return {
          Headers: { 'x-after-auth': ['yes'] },
          Body: encodedPluginBytes(
            JSON.stringify({ ...parsedPluginBody(request['Body']), after_auth: true }),
          ),
        };
      }

      responseContext = request;

      return {};
    });
    const host = await responseHost([['combined', 1, plugin]]);
    const { app } = responseGateway(host, chatAnswer);

    const answer = await askResponseGateway(app, false);

    expect(answer.status).toBe(200);
    expect(parsedPluginBody(responseContext?.['OriginalRequest'])).toHaveProperty(
      'after_auth',
      true,
    );
    expect(parsedPluginBody(responseContext?.['RequestBody'])).toHaveProperty('after_auth', true);
    expect(headerValue(responseContext?.['RequestHeaders'], 'x-after-auth')).toBe('yes');
  });
});

describe('gateway stream chunk plugin rewriting', () => {
  it('should initialize headers then rewrite chunks with delivered history', async () => {
    const calls: { index: number; body: string; history: string[] }[] = [];
    const plugin = responsePlugin({ stream: true }, (_method, request) => {
      const index = numberField(request, 'ChunkIndex');

      calls.push({
        index,
        body: decodedPluginBytes(request['Body']),
        history: decodedHistory(request['HistoryChunks']),
      });

      if (index === -1) return { Headers: { 'x-stream-init': ['yes'] } };

      return {
        Headers: { 'x-late-header': [String(index)] },
        Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|${String(index)}`),
      };
    });
    const host = await responseHost([['stream', 1, plugin]]);
    const { app } = responseGateway(host, () => pluginStreamAnswer(['first', 'second']));

    const answer = await askResponseGateway(app);
    const text = await answer.text();

    expect(answer.headers.get('x-stream-init')).toBe('yes');
    expect(answer.headers.has('x-late-header')).toBe(false);
    expect(text).toBe('first|0second|1');
    expect(calls).toEqual([
      { index: -1, body: '', history: [] },
      { index: 0, body: 'first', history: [] },
      { index: 1, body: 'second', history: ['first|0'] },
    ]);
  });

  it('should exclude a dropped chunk from delivery and history', async () => {
    const histories: string[][] = [];
    const plugin = responsePlugin({ stream: true }, (_method, request) => {
      const index = numberField(request, 'ChunkIndex');

      if (index === -1) return {};

      histories.push(decodedHistory(request['HistoryChunks']));

      return index === 0 ? { DropChunk: true } : {};
    });
    const host = await responseHost([['stream', 1, plugin]]);
    const { app } = responseGateway(host, () => pluginStreamAnswer(['drop', 'keep']));

    const answer = await askResponseGateway(app);

    await expect(answer.text()).resolves.toBe('keep');
    expect(histories).toEqual([[], []]);
  });
});

// Helpers

function chatAnswer(): Response {
  return Response.json({
    id: 'chatcmpl_1',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
  });
}

function parsedRecord(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);

  if (!isJsonObject(parsed)) throw new Error('plugin JSON body is invalid');

  return parsed;
}

function parsedPluginBody(value: unknown): Record<string, unknown> {
  return parsedRecord(decodedPluginBytes(value));
}

function headerValue(value: unknown, name: string): string | undefined {
  if (!isJsonObject(value)) return undefined;

  const entry = Object.entries(value).find(([key]) => key.toLowerCase() === name);
  const values = entry?.[1];

  return firstString(values);
}

function firstString(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.find((item): item is string => typeof item === 'string');
}

function numberField(request: Record<string, unknown>, name: string): number {
  const value = request[name];

  return typeof value === 'number' ? value : 0;
}

function decodedHistory(value: unknown): string[] {
  return Array.isArray(value) ? value.map(decodedPluginBytes) : [];
}

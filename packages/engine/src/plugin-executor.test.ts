import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { PluginExecutorRequest } from './plugin-executor';

import { isJsonObject } from './gateway-wire';
import { pluginMethods } from './plugin-abi';
import { PluginExecutorAdapter } from './plugin-executor';
import { PluginHost } from './plugin-host';

describe('PluginExecutorAdapter metadata', () => {
  it('should expose the identifier, formats, and model scope', async () => {
    const fixture = await executorFixture();

    await expect(fixture.adapter.identifier()).resolves.toBe('plugin-provider');
    expect(fixture.adapter.formats()).toEqual({
      input: ['chat-completions'],
      output: ['responses'],
      scope: 'static',
    });
  });
});

describe('PluginExecutorAdapter execution', () => {
  it('should map the full executor request and clone its response', async () => {
    const fixture = await executorFixture();
    const request = executorRequest();

    const response = await fixture.adapter.execute(request);
    const sent = fixture.requests.get(pluginMethods.executorExecute);

    expect(sent).toMatchObject({
      AuthID: 'auth-1',
      AuthProvider: 'plugin-provider',
      Model: 'model-1',
      Format: 'responses',
      SourceFormat: 'chat-completions',
      Payload: 'eyJtb2RlbCI6Im1vZGVsLTEifQ==',
      OriginalRequest: 'eyJvcmlnaW5hbCI6dHJ1ZX0=',
      Metadata: { request: 'metadata' },
      AuthMetadata: { token: 'metadata' },
      AuthAttributes: { region: 'us' },
    });
    expect(new TextDecoder().decode(response.payload)).toBe('{"id":"response-1"}');
    expect(response.headers.get('x-execute')).toBe('1');
    expect(response.metadata).toEqual({ phase: 'execute' });
  });

  it('should map buffered native stream chunks and errors', async () => {
    const fixture = await executorFixture();

    const stream = await fixture.adapter.executeStream(executorRequest());

    expect(stream.headers.get('content-type')).toBe('text/event-stream');
    expect(
      stream.chunks.map(({ payload, error }) => ({
        text: new TextDecoder().decode(payload),
        error,
      })),
    ).toEqual([
      { text: 'data: one\n\n', error: undefined },
      { text: '', error: 'stream failed' },
    ]);
    expect(fixture.requests.get(pluginMethods.executorStream)).toHaveProperty('Stream', true);
  });

  it('should map countTokens through the same executor request contract', async () => {
    const fixture = await executorFixture();

    const response = await fixture.adapter.countTokens(executorRequest());

    expect(new TextDecoder().decode(response.payload)).toBe('{"total_tokens":3}');
    expect(fixture.requests.has(pluginMethods.executorCountTokens)).toBe(true);
  });
});

// Helpers

async function executorFixture() {
  const requests = new Map<string, Record<string, unknown>>();
  const client: PluginClient = {
    call: async (method, request) => {
      await Promise.resolve();
      const parsed: unknown = JSON.parse(new TextDecoder().decode(request));

      if (isJsonObject(parsed)) requests.set(method, parsed);

      return responseFor(method);
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('executor', '/executor');

  return { adapter: new PluginExecutorAdapter(host, 'executor'), requests };
}

function responseFor(method: string): Uint8Array {
  if (method === pluginMethods.register) {
    return encoded({
      ok: true,
      result: {
        schema_version: 2,
        metadata: { name: 'executor' },
        capabilities: {
          executor: true,
          executor_model_scope: 'static',
          executor_input_formats: ['chat-completions'],
          executor_output_formats: ['responses'],
        },
      },
    });
  }

  if (method === 'executor.identifier') {
    return encoded({ ok: true, result: { identifier: 'Plugin-Provider' } });
  }

  if (method === pluginMethods.executorStream) {
    return encoded({
      ok: true,
      result: {
        headers: { 'content-type': ['text/event-stream'] },
        chunks: [
          { Payload: Buffer.from('data: one\n\n').toString('base64') },
          { Error: 'stream failed' },
        ],
      },
    });
  }

  if (method === pluginMethods.executorCountTokens) {
    return encoded({
      ok: true,
      result: { Payload: Buffer.from('{"total_tokens":3}').toString('base64') },
    });
  }

  return encoded({
    ok: true,
    result: {
      Payload: Buffer.from('{"id":"response-1"}').toString('base64'),
      Headers: { 'x-execute': ['1'] },
      Metadata: { phase: 'execute' },
    },
  });
}

function executorRequest(): PluginExecutorRequest {
  return {
    authId: 'auth-1',
    authProvider: 'plugin-provider',
    model: 'model-1',
    format: 'responses',
    stream: false,
    alt: '',
    headers: { 'x-request': ['yes'] },
    query: { beta: ['true'] },
    originalRequest: new TextEncoder().encode('{"original":true}'),
    sourceFormat: 'chat-completions',
    payload: new TextEncoder().encode('{"model":"model-1"}'),
    metadata: { request: 'metadata' },
    storageJSON: new TextEncoder().encode('{"token":"stored"}'),
    authMetadata: { token: 'metadata' },
    authAttributes: { region: 'us' },
  };
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

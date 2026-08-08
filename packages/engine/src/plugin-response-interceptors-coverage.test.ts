import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';
import type { PluginStreamChunkIntercept } from './plugin-response-interceptors';

import { pluginMethods } from './plugin-abi';
import {
  decodedPluginBytes,
  encodedPluginBytes,
  responseHost,
  responsePlugin,
} from './plugin-response-interceptor.testkit';
import { interceptPluginStreamChunk } from './plugin-response-interceptors';

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function registration(): Uint8Array {
  return encoded({
    ok: true,
    result: {
      schema_version: 2,
      metadata: { name: 'stream interceptor' },
      capabilities: {
        request_interceptor: false,
        response_interceptor: false,
        response_stream_interceptor: true,
      },
    },
  });
}

function speaksNoDocument() {
  const methods: string[] = [];
  const requests: Record<string, unknown>[] = [];
  const client: PluginClient = {
    call: async (method) => {
      await Promise.resolve();
      methods.push(method);

      return method === pluginMethods.register
        ? registration()
        : encoded({ ok: true, result: 'not a document' });
    },
    shutdown: () => undefined,
  };

  return { client, methods, requests };
}

function streamRequest(): PluginStreamChunkIntercept {
  return {
    requestId: 'request-1',
    sourceFormat: 'chat-completions',
    model: 'provider-model',
    requestedModel: 'virtual-model',
    requestHeaders: {},
    responseHeaders: { 'content-type': ['text/event-stream'] },
    originalRequest: new TextEncoder().encode('original'),
    requestBody: new TextEncoder().encode('request'),
    body: new TextEncoder().encode('chunk'),
    metadata: {},
    historyChunks: [],
    chunkIndex: 0,
  };
}

describe('a stream chunk interceptor the host cannot read', () => {
  it('should fuse a plugin whose answer is not a document and keep going', async () => {
    const broken = speaksNoDocument();
    const fallback = responsePlugin({ stream: true }, (_method, request) => ({
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|fallback`),
    }));
    const host = await responseHost([
      ['broken', 20, broken],
      ['fallback', 10, fallback],
    ]);

    const result = await interceptPluginStreamChunk(host, streamRequest());

    expect(new TextDecoder().decode(result.body)).toBe('chunk|fallback');
    expect(host.routingRecords().map(({ id }) => id)).toEqual(['fallback']);
  });
});

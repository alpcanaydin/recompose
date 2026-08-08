import { describe, expect, it } from 'vitest';

import { pluginMethods } from './plugin-abi';
import {
  decodedPluginBytes,
  encodedPluginBytes,
  responseHost,
  responsePlugin,
} from './plugin-response-interceptor.testkit';
import {
  interceptPluginResponse,
  interceptPluginStreamChunk,
  type PluginResponseIntercept,
  type PluginStreamChunkIntercept,
} from './plugin-response-interceptors';

describe('plugin response interceptor priority chain', () => {
  it('should chain response body and header changes', async () => {
    const high = responsePlugin({ response: true }, (_method, request) => ({
      Headers: { 'x-response': ['high'] },
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|high`),
    }));
    const low = responsePlugin({ response: true }, (_method, request) => ({
      Headers: { 'x-response': ['low'], 'x-low': ['1'] },
      ClearHeaders: ['x-remove'],
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|low`),
    }));
    const host = await responseHost([
      ['low', 10, low],
      ['high', 20, high],
    ]);

    const result = await interceptPluginResponse(host, responseRequest());

    expect(new TextDecoder().decode(result.body)).toBe('body|high|low');
    expect(result.headers).toEqual({
      'content-type': ['application/json'],
      'x-response': ['low'],
      'x-low': ['1'],
    });
    expect(decodedPluginBytes(low.requests[0]?.['Body'])).toBe('body|high');
  });

  it('should skip the originating plugin', async () => {
    const origin = responsePlugin({ response: true }, () => ({
      Body: encodedPluginBytes('origin'),
    }));
    const other = responsePlugin({ response: true }, (_method, request) => ({
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|other`),
    }));
    const host = await responseHost([
      ['origin', 20, origin],
      ['other', 10, other],
    ]);

    const result = await interceptPluginResponse(host, responseRequest(), 'origin');

    expect(new TextDecoder().decode(result.body)).toBe('body|other');
    expect(origin.methods).not.toContain(pluginMethods.responseInterceptAfter);
  });
});

describe('plugin stream chunk interceptor chain', () => {
  it('should pass history and chained changes to lower-priority plugins', async () => {
    const high = responsePlugin({ stream: true }, (_method, request) => ({
      Headers: { 'x-stream': ['high'] },
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|high`),
    }));
    const low = responsePlugin({ stream: true }, (_method, request) => ({
      Headers: { 'x-stream': ['low'] },
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|low`),
    }));
    const host = await responseHost([
      ['low', 10, low],
      ['high', 20, high],
    ]);

    const result = await interceptPluginStreamChunk(host, streamRequest());

    expect(new TextDecoder().decode(result.body)).toBe('chunk|high|low');
    expect(result.headers['x-stream']).toEqual(['low']);
    expect(low.requests[0]?.['HistoryChunks']).toEqual([encodedPluginBytes('first')]);
    expect(low.requests[0]?.['ChunkIndex']).toBe(1);
  });

  it('should stop the chain when a plugin drops the chunk', async () => {
    const high = responsePlugin({ stream: true }, (_method, request) => ({
      Headers: { 'x-stream': ['high'] },
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|high`),
      DropChunk: true,
    }));
    const low = responsePlugin({ stream: true }, () => ({ Body: encodedPluginBytes('low') }));
    const host = await responseHost([
      ['low', 10, low],
      ['high', 20, high],
    ]);

    const result = await interceptPluginStreamChunk(host, streamRequest());

    expect(result.dropChunk).toBe(true);
    expect(new TextDecoder().decode(result.body)).toBe('chunk|high');
    expect(low.methods).not.toContain(pluginMethods.responseInterceptStreamChunk);
  });
});

describe('plugin response interceptor failures', () => {
  it('should fuse a failing interceptor and continue', async () => {
    const broken = responsePlugin({ response: true }, () => {
      throw new Error('broken response interceptor');
    });
    const fallback = responsePlugin({ response: true }, (_method, request) => ({
      Body: encodedPluginBytes(`${decodedPluginBytes(request['Body'])}|fallback`),
    }));
    const host = await responseHost([
      ['broken', 20, broken],
      ['fallback', 10, fallback],
    ]);

    const result = await interceptPluginResponse(host, responseRequest());

    expect(new TextDecoder().decode(result.body)).toBe('body|fallback');
    expect(host.routingRecords().map(({ id }) => id)).toEqual(['fallback']);
  });
});

// Helpers

function responseRequest(): PluginResponseIntercept {
  return {
    requestId: 'request-1',
    sourceFormat: 'chat-completions',
    model: 'provider-model',
    requestedModel: 'virtual-model',
    requestHeaders: { authorization: ['Bearer secret'] },
    responseHeaders: { 'content-type': ['application/json'], 'x-remove': ['yes'] },
    originalRequest: new TextEncoder().encode('original'),
    requestBody: new TextEncoder().encode('request'),
    body: new TextEncoder().encode('body'),
    statusCode: 200,
    metadata: {},
  };
}

function streamRequest(): PluginStreamChunkIntercept {
  const base = responseRequest();

  return {
    ...base,
    body: new TextEncoder().encode('chunk'),
    historyChunks: [new TextEncoder().encode('first')],
    chunkIndex: 1,
  };
}

import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { Crossing } from './gateway-wire';
import type { PluginGatewayTarget } from './plugin-gateway';
import type { PluginRoutingHost, PluginRoutingRecord } from './plugin-routing';

import { PluginExecutorAdapter } from './plugin-executor';
import { reachPluginExecutor, selectedPluginDialect } from './plugin-gateway';

type ExecutorTarget = Extract<PluginGatewayTarget, { kind: 'executor' }>;
type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type Sent = { wire: unknown[] };

describe('plugin dialect selection', () => {
  it('should speak the dialect the caller already uses when the plugin knows it', () => {
    const chosen = selectedPluginDialect(['claude', 'openai'], 'chat-completions');

    expect(chosen).toBe('chat-completions');
  });

  it('should fall back to the first dialect the plugin knows', () => {
    const chosen = selectedPluginDialect(['claude', 'openai'], 'gemini');

    expect(chosen).toBe('anthropic');
  });

  it('should refuse a plugin that names no dialect this gateway speaks', () => {
    const chosen = selectedPluginDialect(['cobol', 'soap'], 'anthropic');

    expect(chosen).toBeNull();
  });

  it('should refuse a plugin that names no dialect at all', () => {
    const chosen = selectedPluginDialect([], 'anthropic');

    expect(chosen).toBeNull();
  });
});

describe('plugin executor answers', () => {
  it('should call an unlabelled plugin answer JSON', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({ Payload: encoded('{"ok":true}') }));

    const answer = await reachPluginExecutor(
      executorTarget(host),
      crossing(),
      credentialedGrant(),
      { model: 'fast' },
    );

    expect(answer.headers.get('content-type')).toBe('application/json');
    await expect(answer.text()).resolves.toBe('{"ok":true}');
  });

  it('should keep the content type a plugin states for its answer', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({
      Payload: encoded('plain words'),
      Headers: { 'content-type': ['text/plain'] },
    }));

    const answer = await reachPluginExecutor(
      executorTarget(host),
      crossing(),
      credentialedGrant(),
      { model: 'fast' },
    );

    expect(answer.headers.get('content-type')).toBe('text/plain');
  });
});

describe('plugin executor streams', () => {
  it('should call an unlabelled plugin stream a server-sent event stream', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({
      Chunks: [{ Payload: encoded('data: one\n\n') }, { Payload: encoded('data: two\n\n') }],
    }));

    const answer = await reachPluginExecutor(
      executorTarget(host),
      streamingCrossing(),
      credentialedGrant(),
      { model: 'fast' },
    );

    expect(answer.headers.get('content-type')).toBe('text/event-stream');
    await expect(answer.text()).resolves.toBe('data: one\n\ndata: two\n\n');
  });

  it('should break the stream at the chunk the plugin reports as failed', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({
      Chunks: [{ Payload: encoded('data: one\n\n') }, { Error: 'upstream reset' }],
    }));

    const answer = await reachPluginExecutor(
      executorTarget(host),
      streamingCrossing(),
      credentialedGrant(),
      { model: 'fast' },
    );

    await expect(answer.text()).rejects.toThrow('upstream reset');
  });
});

describe('plugin executor request assembly', () => {
  it('should name no provider and carry no credential for an open account', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({ Payload: encoded('{}') }));

    await reachPluginExecutor(executorTarget(host), crossing(), openGrant(), { model: 'fast' });

    expect(sent.wire[0]).toMatchObject({ AuthProvider: '', AuthID: '', StorageJSON: '' });
  });

  it('should send empty header and query maps when the crossing carries none', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({ Payload: encoded('{}') }));

    await reachPluginExecutor(executorTarget(host), crossing(), credentialedGrant(), {
      model: 'fast',
    });

    expect(sent.wire[0]).toMatchObject({ Headers: {}, Query: {} });
  });

  it('should send the header and query maps the crossing already carries', async () => {
    const sent: Sent = { wire: [] };
    const host = executorHost(sent, () => ({ Payload: encoded('{}') }));
    const carried: Crossing = {
      ...crossing(),
      requestHeaders: { 'x-session-id': ['session-1'] },
      requestQuery: { alt: ['sse'] },
    };

    await reachPluginExecutor(executorTarget(host), carried, credentialedGrant(), {
      model: 'fast',
    });

    expect(sent.wire[0]).toMatchObject({
      Headers: { 'x-session-id': ['session-1'] },
      Query: { alt: ['sse'] },
    });
  });
});

function executorTarget(host: PluginRoutingHost): ExecutorTarget {
  return {
    kind: 'executor',
    adapter: new PluginExecutorAdapter(host, 'plugin-executor'),
    inputDialect: 'chat-completions',
    outputDialect: 'chat-completions',
  };
}

function executorHost(sent: Sent, answer: (method: string) => unknown): PluginRoutingHost {
  return {
    routingRecords: () => [executorRecord()],
    call: async (_id, method, request, decode) => {
      sent.wire.push(request);
      await Promise.resolve();

      return decode(answer(method));
    },
  };
}

function executorRecord(): PluginRoutingRecord {
  return {
    id: 'plugin-executor',
    priority: 1,
    metadata: {},
    executor: true,
    executorModelScope: 'both',
    executorInputFormats: ['chat-completions'],
    executorOutputFormats: ['chat-completions'],
    scheduler: false,
    modelRouter: false,
    requestInterceptor: false,
    responseInterceptor: false,
    streamChunkInterceptor: false,
  };
}

function crossing(): Crossing {
  return {
    dialect: 'chat-completions',
    raw: { model: 'fast', messages: [] },
    gatewayName: 'local',
    virtualModel: 'fast',
    providerModel: 'plugin-model',
  };
}

function streamingCrossing(): Crossing {
  return { ...crossing(), raw: { model: 'fast', messages: [], stream: true } };
}

function credentialedGrant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'plugin://plugin-provider',
    spend: {
      custody: 'credentialed',
      provider: 'plugin-provider',
      credential: 'plugin-secret',
      accountId: 'acc-plugin',
    },
  };
}

function openGrant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'http://127.0.0.1:11434',
    spend: { custody: 'open' },
  };
}

function encoded(value: string): string {
  return Buffer.from(value).toString('base64');
}

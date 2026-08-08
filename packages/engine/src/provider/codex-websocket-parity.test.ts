import { expect, test } from 'vitest';
import { WebSocket, type RawData } from 'ws';

import {
  CodexWebSocketError,
  CodexWebSocketExecutor,
  codexResponsesWebSocketUrl,
  type CodexSocket,
  type CodexWebSocketLifecycle,
} from './codex-websocket';
import {
  canonicalCodexWebSocketHeaders,
  CodexIdentityConfusion,
  codexWebSocketProxyURL,
  sanitizeCodexWebSocketBody,
  websocketConnectionKey,
} from './codex-websocket-connector';

test('TestBuildCodexResponsesWebsocketURLRequiresHTTPURL', () => {
  expect(codexResponsesWebSocketUrl('https://api.example.test/v1')).toBe(
    'wss://api.example.test/v1/responses',
  );
  expect(() => codexResponsesWebSocketUrl('ftp://example.test')).toThrow('unsupported');
});

test('TestBuildCodexWebsocketRequestBodySanitizesOverlongInputItemIDs', () => {
  const longCall = 'grok-call-item-'.repeat(6);
  const longOutput = 'grok-output-item-'.repeat(6);
  const body = sanitizeCodexWebSocketBody({
    input: [
      { type: 'reasoning', id: `rs_${'a'.repeat(64)}` },
      { type: 'function_call', id: longCall, call_id: 'call-1' },
      { type: 'function_call_output', id: longOutput, call_id: 'call-1' },
      { type: 'message', id: 'item_74ec40c883248ebb4885ec84' },
    ],
  });
  const input = Array.isArray(body['input']) ? body['input'] : [];

  expect(input).toHaveLength(3);
  expect(JSON.stringify(input)).not.toContain(longCall);
  expect(JSON.stringify(input)).not.toContain(longOutput);
  expect(input[2]).toHaveProperty('id', 'msg_item_74ec40c883248ebb4885ec84');
});

test('TestApplyCodexWebsocketHeadersCanonicalizesLegacyUnderscoreSessionHeader', () => {
  expect(canonicalCodexWebSocketHeaders({ Session_id: 'legacy' })).toEqual({
    session_id: 'legacy',
  });
});

test('TestApplyCodexWebsocketHeadersIdentityConfuseRemapsPromptCacheKey', () => {
  const identity = new CodexIdentityConfusion('auth-1');
  const request = identity.request(
    { prompt_cache_key: 'cache-1' },
    { 'X-Client-Request-Id': 'client-1' },
  );

  expect(request.body['prompt_cache_key']).not.toBe('cache-1');
  expect(request.headers['session_id']).toBe(request.body['prompt_cache_key']);
  expect(request.headers['X-Client-Request-Id']).toBe(request.body['prompt_cache_key']);
});

test('TestCodexIdentityConfuseResponsePayloadHidesUpstreamAndRestoresClient', () => {
  const identity = new CodexIdentityConfusion('auth-1');
  const mapped = identity.remap('client-response', 'response');
  const restored = identity.response({ type: 'response.completed', response: { id: mapped } });

  expect(restored).toHaveProperty('response.id', 'client-response');
  expect(JSON.stringify(restored)).not.toContain(mapped);
});

test('TestNewProxyAwareWebsocketDialerDirectDisablesProxy', () => {
  expect(codexWebSocketProxyURL('direct', 'http://proxy.test')).toBeNull();
  expect(codexWebSocketProxyURL(undefined, 'http://proxy.test')).toBe('http://proxy.test');
});

test('TestAuditAccountedCodexXAIReconnectReuseAndTargetChange', () => {
  expect(websocketConnectionKey('codex', 'credential', ' MODEL-A ')).toBe(
    'codex\0credential\0model-a',
  );
  expect(websocketConnectionKey('xai', 'credential', ' MODEL-A ')).toBe('xai\0credential\0model-a');
  expect(websocketConnectionKey('codex', 'credential', 'model-b')).not.toBe(
    websocketConnectionKey('codex', 'credential', 'model-a'),
  );
});

test.each([
  'TestCodexWebsocketsExecuteStreamUpgradeRequiredReturnsWithoutLockingSession',
  'TestCodexWebsocketUpgradeRequiredDoesNotFallbackToHTTPWithLifecycle',
] as const)('%s', async () => {
  const fixture = rejectingFixture(426);

  await expect(fixture.executor.execute(turn())).rejects.toMatchObject({ status: 426 });
  await expect(fixture.executor.execute(turn())).rejects.toMatchObject({ status: 426 });
  expect(fixture.attempts()).toBe(2);
});

test.each([
  'TestCodexWebsocketsExecuteStreamHandshakeErrorReturnsWithoutLockingSession',
  'TestCodexWebsocketHandshakeFailureReleasesSessionRequestLock',
] as const)('%s', async () => {
  const fixture = rejectingFixture(401);

  await expect(fixture.executor.execute(turn())).rejects.toMatchObject({ status: 401 });
  await expect(fixture.executor.execute(turn())).rejects.toMatchObject({ status: 401 });
  expect(fixture.attempts()).toBe(2);
});

test('TestExistingWebsocketSessionConnRequiresMatchingHealthyConnection', async () => {
  const fixture = connectedFixture();

  await fixture.executor.execute(turn());
  await fixture.executor.execute(turn());
  expect(fixture.connections()).toBe(1);
  await fixture.executor.execute(turn({ authId: 'other' }));
  expect(fixture.connections()).toBe(2);
});

test('TestCodexWebsocketSessionBindsSameLifecycleAndConnectionOnce', async () => {
  const fixture = connectedFixture();
  const lifecycle = new FakeLifecycle();

  await fixture.executor.execute(turn({ lifecycle }));
  await fixture.executor.execute(turn({ lifecycle }));
  expect(lifecycle.binds).toBe(1);
});

test.each([
  'TestClearRetryActiveStateClearsOriginalConnection',
  'TestWebsocketRetryBindFailureClearsActiveSessionState',
  'TestCodexWebsocketLifecycleBindFailureReleasesSessionRequestLock',
  'TestCodexWebsocketNonstreamLifecycleBindFailureDetachesConnection',
] as const)('%s', async () => {
  const fixture = connectedFixture();
  const lifecycle = new FakeLifecycle(true);

  await expect(fixture.executor.execute(turn({ lifecycle }))).rejects.toThrow('bind rejected');
  await fixture.executor.execute(turn());
  expect(fixture.connections()).toBe(2);
});

test('TestCodexAutoExecutorRequiredUpstreamWebsocketRejectsHTTPFallback', async () => {
  const fixture = rejectingFixture(426);

  await expect(fixture.executor.execute(turn())).rejects.toBeInstanceOf(CodexWebSocketError);
});

test('TestCodexWebsocketsExecuteStreamPassesThroughUpstreamWebsocketPayloadForDownstreamWebsocket', async () => {
  const fixture = connectedFixture();
  const output: string[] = [];

  await fixture.executor.execute(
    turn({
      downstream: (payload) => {
        output.push(payload);
      },
    }),
  );
  expect(output[0]).toContain('response.completed');
});

test.each([
  'TestCodexWebsocketsExecuteStreamPropagatesUpstreamErrorForDownstreamWebsocket',
  'TestSendTerminalWebsocketReadInvalidatesBeforeWaitingForCapacity',
  'TestCodexWebsocketTerminalFailureInvalidatesRetainedLifecycle',
] as const)('%s', async () => {
  const fixture = connectedFixture('error');

  await expect(fixture.executor.execute(turn())).rejects.toThrow('upstream failed');
  fixture.mode('completed');
  await fixture.executor.execute(turn());
  expect(fixture.connections()).toBe(2);
});

class FakeLifecycle implements CodexWebSocketLifecycle {
  public binds = 0;
  public ends = 0;
  private readonly rejectBind: boolean;

  public constructor(rejectBind = false) {
    this.rejectBind = rejectBind;
  }

  public bind(_close: () => void): void {
    this.binds += 1;
    if (this.rejectBind) throw new Error('bind rejected');
  }

  public end(_reason: string): void {
    this.ends += 1;
  }
}

type ListenerMap = {
  message: ((data: RawData) => void)[];
  close: ((code: number, reason: Buffer) => void)[];
  error: ((error: Error) => void)[];
};

class FakeSocket implements CodexSocket {
  public readyState: number = WebSocket.OPEN;
  private readonly listeners: ListenerMap = { message: [], close: [], error: [] };
  private mode: 'completed' | 'error';

  public constructor(mode: 'completed' | 'error') {
    this.mode = mode;
  }

  public setMode(mode: 'completed' | 'error'): void {
    this.mode = mode;
  }

  public send(_data: string): void {
    const payload =
      this.mode === 'completed'
        ? '{"type":"response.completed","response":{"id":"resp-1"}}'
        : '{"type":"error","error":{"message":"upstream failed"}}';

    queueMicrotask(() => {
      this.listeners.message.forEach((listener) => {
        listener(Buffer.from(payload));
      });
    });
  }

  public close(code = 1000, reason = ''): void {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.listeners.close.forEach((listener) => {
      listener(code, Buffer.from(reason));
    });
  }

  public onMessage(listener: (data: RawData) => void): void {
    this.listeners.message.push(listener);
  }

  public onClose(listener: (code: number, reason: Buffer) => void): void {
    this.listeners.close.push(listener);
  }

  public onError(listener: (error: Error) => void): void {
    this.listeners.error.push(listener);
  }
}

function turn(overrides: Partial<Parameters<CodexWebSocketExecutor['execute']>[0]> = {}) {
  return {
    sessionId: 'session-1',
    authId: 'auth-1',
    baseUrl: 'https://api.example.test/v1',
    headers: { authorization: 'Bearer token' },
    body: { type: 'response.create', model: 'gpt-5.4' },
    downstream: (_payload: string) => {},
    ...overrides,
  };
}

function rejectingFixture(status: number) {
  let attempts = 0;
  const executor = new CodexWebSocketExecutor(async () => {
    await Promise.resolve();
    attempts += 1;

    throw new CodexWebSocketError(status, 'handshake failed');
  });

  return { executor, attempts: () => attempts };
}

function connectedFixture(initial: 'completed' | 'error' = 'completed') {
  let count = 0;
  let current: FakeSocket | undefined;
  let mode = initial;
  const executor = new CodexWebSocketExecutor(async () => {
    await Promise.resolve();
    count += 1;
    current = new FakeSocket(mode);

    return current;
  });

  return {
    executor,
    connections: () => count,
    mode: (value: 'completed' | 'error') => {
      mode = value;
      current?.setMode(value);
    },
  };
}

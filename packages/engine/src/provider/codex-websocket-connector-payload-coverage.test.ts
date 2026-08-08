import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import {
  canonicalCodexWebSocketHeaders,
  CodexIdentityConfusion,
  codexResponsesWebSocketUrl,
  codexWebSocketProxyURL,
  sanitizeCodexWebSocketBody,
} from './codex-websocket-connector';

function sanitizedInput(...input: unknown[]): unknown[] {
  const body = sanitizeCodexWebSocketBody({ input });

  return Array.isArray(body['input']) ? body['input'] : [];
}

describe('the Codex responses WebSocket URL', () => {
  test('a plaintext Codex origin is dialled over ws', () => {
    expect(codexResponsesWebSocketUrl('http://127.0.0.1:1455/backend-api/codex/')).toBe(
      'ws://127.0.0.1:1455/backend-api/codex/responses',
    );
  });

  test('the query and fragment a caller sent are dropped from the dialled URL', () => {
    expect(codexResponsesWebSocketUrl('https://chatgpt.com/backend-api/codex?a=1#b')).toBe(
      'wss://chatgpt.com/backend-api/codex/responses',
    );
  });
});

describe('sanitizing the input a Codex WebSocket turn carries', () => {
  test('a body whose input is not a list is passed through untouched', () => {
    expect(sanitizeCodexWebSocketBody({ model: 'gpt-5', input: 'hello' })).toStrictEqual({
      model: 'gpt-5',
      input: 'hello',
    });
  });

  test('an input entry that is not an object is kept as it stands', () => {
    expect(sanitizedInput('raw-entry', 42)).toStrictEqual(['raw-entry', 42]);
  });

  test('an entry without a string identifier is kept as it stands', () => {
    const entries = sanitizedInput({ type: 'message', role: 'user' }, { type: 'message', id: 7 });

    expect(entries).toStrictEqual([
      { type: 'message', role: 'user' },
      { type: 'message', id: 7 },
    ]);
  });

  test('an identifier already short enough is left alone', () => {
    expect(sanitizedInput({ type: 'function_call', id: 'fc_short' })).toStrictEqual([
      { type: 'function_call', id: 'fc_short' },
    ]);
  });
});

describe('the Codex session header', () => {
  test('a canonical session header is carried through under the wire name', () => {
    const headers = canonicalCodexWebSocketHeaders({
      'Session-Id': 'sess-1',
      Accept: 'text/event-stream',
    });

    expect(headers).toStrictEqual({ session_id: 'sess-1', Accept: 'text/event-stream' });
  });

  test('headers naming no session are left as they came', () => {
    expect(canonicalCodexWebSocketHeaders({ Accept: 'text/event-stream' })).toStrictEqual({
      Accept: 'text/event-stream',
    });
  });
});

describe('choosing the proxy for a Codex WebSocket dial', () => {
  test('an account that asks to go direct bypasses every proxy', () => {
    expect(codexWebSocketProxyURL('direct', 'http://machine.test:8080')).toBeNull();
  });

  test('the account proxy is preferred over the machine proxy', () => {
    expect(codexWebSocketProxyURL('http://account.test:8080', 'http://machine.test:8080')).toBe(
      'http://account.test:8080',
    );
  });

  test('the machine proxy serves an account that names none', () => {
    expect(codexWebSocketProxyURL(undefined, 'http://machine.test:8080')).toBe(
      'http://machine.test:8080',
    );
  });

  test('naming no proxy anywhere leaves the dial direct', () => {
    expect(codexWebSocketProxyURL(undefined, undefined)).toBeNull();
  });
});

describe('confusing the Codex identity across a turn', () => {
  test('a body without a prompt cache key travels unchanged', () => {
    const confusion = new CodexIdentityConfusion('key-1');
    const request = confusion.request({ model: 'gpt-5' }, { Accept: 'text/event-stream' });

    expect(request).toStrictEqual({
      body: { model: 'gpt-5' },
      headers: { Accept: 'text/event-stream' },
    });
  });

  test('a frame that holds no response object is handed back unchanged', () => {
    const confusion = new CodexIdentityConfusion('key-1');

    expect(confusion.response('not-an-object')).toBe('not-an-object');
    expect(confusion.response({ type: 'response.created' })).toStrictEqual({
      type: 'response.created',
    });
  });

  test('a response without an identifier is handed back unchanged', () => {
    const confusion = new CodexIdentityConfusion('key-1');
    const frame: JsonObject = { type: 'response.created', response: { status: 'in_progress' } };

    expect(confusion.response(frame)).toStrictEqual(frame);
  });

  test('an identifier the turn never remapped is restored as itself', () => {
    const confusion = new CodexIdentityConfusion('key-1');
    const frame = { type: 'response.completed', response: { id: 'resp_upstream' } };

    expect(confusion.response(frame)).toStrictEqual(frame);
  });
});

import { describe, expect, test } from 'vitest';

import {
  upstreamXAIWebSocketUrl,
  xaiWebSocketErrorPayload,
  xaiWebSocketRequestBody,
  xaiWebSocketText,
} from './xai-websocket-wire';

describe('the upstream xAI WebSocket URL', () => {
  test('a plaintext origin is dialled over ws', () => {
    expect(upstreamXAIWebSocketUrl('http://localhost:9099')).toBe('ws://localhost:9099/responses');
  });

  test('a secure origin is dialled over wss', () => {
    expect(upstreamXAIWebSocketUrl('https://api.x.ai/v1')).toBe('wss://api.x.ai/v1/responses');
  });

  test('trailing slashes on the origin do not double up in the path', () => {
    expect(upstreamXAIWebSocketUrl('https://api.x.ai/v1///')).toBe('wss://api.x.ai/v1/responses');
  });

  test('an origin on an unsupported scheme is refused by name', () => {
    expect(() => upstreamXAIWebSocketUrl('ftp://api.x.ai')).toThrow(
      'unsupported xAI WebSocket URL scheme ftp:',
    );
  });
});

describe('the xAI WebSocket request body', () => {
  test('a flat body becomes a response.create that asks upstream to store the turn', () => {
    const body = xaiWebSocketRequestBody({ model: 'grok-4', input: [], stream: true });

    expect(body).toStrictEqual({
      model: 'grok-4',
      input: [],
      type: 'response.create',
      store: true,
    });
  });

  test('a body nested under response is unwrapped before the envelope is rebuilt', () => {
    const body = xaiWebSocketRequestBody({
      type: 'response.create',
      response: { model: 'grok-4', background: true, stream_options: { include_usage: true } },
    });

    expect(body).toStrictEqual({ model: 'grok-4', type: 'response.create', store: true });
  });

  test('a resumed turn drops the instructions upstream already holds', () => {
    const body = xaiWebSocketRequestBody({
      model: 'grok-4',
      instructions: 'be terse',
      previous_response_id: 'resp_1',
    });

    expect(body).toStrictEqual({
      model: 'grok-4',
      previous_response_id: 'resp_1',
      type: 'response.create',
      store: true,
    });
  });

  test('a blank previous response id leaves the instructions in place', () => {
    const body = xaiWebSocketRequestBody({
      model: 'grok-4',
      instructions: 'be terse',
      previous_response_id: '   ',
    });

    expect(body['instructions']).toBe('be terse');
  });

  test('a non-string previous response id leaves the instructions in place', () => {
    const body = xaiWebSocketRequestBody({
      model: 'grok-4',
      instructions: 'be terse',
      previous_response_id: 7,
    });

    expect(body['instructions']).toBe('be terse');
  });
});

describe('the xAI WebSocket error payload', () => {
  test('an unreadable upstream frame falls back to the caller status', () => {
    expect(xaiWebSocketErrorPayload('not-an-object', 502)).toStrictEqual({
      type: 'error',
      status: 502,
      error: { message: 'upstream WebSocket error' },
    });
  });

  test('a frame without a nested error falls back to the caller status', () => {
    expect(xaiWebSocketErrorPayload({ status: 429 }, 500)).toStrictEqual({
      type: 'error',
      status: 500,
      error: { message: 'upstream WebSocket error' },
    });
  });

  test('a readable upstream error keeps its own status', () => {
    const payload = xaiWebSocketErrorPayload({ error: { message: 'boom', code: 503 } }, 500);

    expect(payload).toStrictEqual({
      type: 'error',
      status: 503,
      error: { message: 'boom', code: 503 },
    });
  });

  test('an exhausted free allowance carries the retry window', () => {
    const payload = xaiWebSocketErrorPayload(
      { error: { message: 'out of credit', code: 'subscription:free-usage-exhausted' } },
      500,
    );

    expect(payload['retry_after_seconds']).toBe(86_400);
  });
});

describe('xAI WebSocket frame text', () => {
  test('a binary frame is read back as its UTF-8 text', () => {
    expect(xaiWebSocketText(Buffer.from('{"type":"response.created"}'))).toBe(
      '{"type":"response.created"}',
    );
  });
});

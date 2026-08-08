import { expect, test } from 'vitest';

import { messageTooBigPayload, parseXAIWebSocketError } from './xai-websocket-error';

test.each([
  {
    type: 'error',
    status: 429,
    error: { code: 'subscription:free-usage-exhausted', message: 'free usage exhausted' },
  },
  {
    status: 429,
    error: { code: 'subscription:free-usage-exhausted', message: 'free usage exhausted' },
  },
])('normalizes typed and bare xAI free-usage errors', (payload) => {
  expect(parseXAIWebSocketError(payload)).toEqual({
    payload: { ...payload, type: 'error', status: 429 },
    status: 429,
    retryAfterSeconds: 86_400,
  });
});

test('infers validation status from a bare xAI error message', () => {
  const parsed = parseXAIWebSocketError({
    error: {
      message:
        'Request validation error: {"code":"400","error":"instructions and previous_response_id"}',
      type: 'api_error',
    },
  });

  expect(parsed).toMatchObject({ payload: { type: 'error', status: 400 }, status: 400 });
  expect(parsed?.retryAfterSeconds).toBeUndefined();
});

test('maps WebSocket close 1009 to a request-scoped message-too-big payload', () => {
  expect(messageTooBigPayload('message too big')).toEqual({
    type: 'error',
    status: 413,
    error: { code: 'message_too_big', message: 'message too big' },
  });
});

test('names an unexplained close reason as message too big', () => {
  expect(messageTooBigPayload('   ')).toEqual({
    type: 'error',
    status: 413,
    error: { code: 'message_too_big', message: 'message too big' },
  });
});

test.each([null, 'boom', 42, ['error'], { type: 'response.completed' }])(
  'declines to read %j as an xAI error envelope',
  (value) => {
    expect(parseXAIWebSocketError(value)).toBeNull();
  },
);

test('reads a status the xAI error spells as a string code', () => {
  expect(parseXAIWebSocketError({ error: { code: '404', message: 'model not found' } })).toEqual({
    payload: {
      type: 'error',
      status: 404,
      error: { code: '404', message: 'model not found' },
    },
    status: 404,
  });
});

test('prefers the envelope status over the nested error code', () => {
  const parsed = parseXAIWebSocketError({
    status_code: 503,
    error: { code: '404', message: 'model not found' },
  });

  expect(parsed?.status).toBe(503);
});

test('ignores status hints that are not whole positive numbers', () => {
  const parsed = parseXAIWebSocketError({
    status: 0,
    status_code: 4.5,
    error: { status: 'not-a-number', code: null, message: 'engine unavailable' },
  });

  expect(parsed).toMatchObject({ status: 500, payload: { status: 500 } });
});

test('reports a server error when the xAI error carries no readable message', () => {
  expect(parseXAIWebSocketError({ error: { message: 42 } })?.status).toBe(500);
});

test('reports a client error when the xAI message names a validation failure', () => {
  expect(parseXAIWebSocketError({ error: { message: 'Request validation error' } })?.status).toBe(
    400,
  );
});

test('reports a client error when the xAI message embeds a 400 code', () => {
  const parsed = parseXAIWebSocketError({ error: { message: 'upstream said {"code":"400"}' } });

  expect(parsed?.status).toBe(400);
});

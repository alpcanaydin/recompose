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

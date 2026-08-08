import { describe, expect, test } from 'vitest';

import {
  codexEventError,
  codexEventErrorBody,
  codexEventErrorStatus,
  type CodexEventError,
} from './codex-event-error';

function errorOf(event: unknown): CodexEventError {
  const error = codexEventError(event);

  if (error === null) throw new Error('the event carried no Codex error');

  return error;
}

function failedEvent(error: unknown): unknown {
  return { type: 'response.failed', response: { error } };
}

describe('reading a Codex error out of a stream event', () => {
  test('reports no error for an event that is not an object', () => {
    expect(codexEventError('response.failed')).toBeNull();
    expect(codexEventError(null)).toBeNull();
  });

  test('reports no error when a failed response carries no error record', () => {
    expect(codexEventError(failedEvent('overloaded'))).toBeNull();
    expect(codexEventError({ type: 'response.failed' })).toBeNull();
  });

  test('names a fallback message when the error record carries none', () => {
    expect(errorOf({ type: 'error', error: {} })).toMatchObject({
      message: 'Codex response failed',
      type: '',
      code: '',
    });
  });
});

describe('classifying a Codex error', () => {
  test('answers 502 for an error the gateway cannot classify', () => {
    expect(codexEventErrorStatus(errorOf(failedEvent({ type: 'server_error' })))).toBe(502);
  });

  test('falls back to a generic code when neither code nor type is present', () => {
    expect(codexEventErrorBody(errorOf({ type: 'error', error: {} }))).toHaveProperty(
      'error.code',
      'api_error',
    );
  });
});

describe('naming the error type an answer carries', () => {
  test('keeps the upstream type when the error declares one', () => {
    const body = codexEventErrorBody(errorOf(failedEvent({ type: 'rate_limit_error' })));

    expect(body).toHaveProperty('error.type', 'rate_limit_error');
  });

  test.each([
    ['context_too_large', 'invalid_request_error'],
    ['invalid_api_key', 'authentication_error'],
    ['upstream_error', 'upstream_error'],
  ])('names the default type for a typeless %s error', (code, expected) => {
    const body = codexEventErrorBody(errorOf(failedEvent({ code, message: 'refused' })));

    expect(body).toHaveProperty('error.type', expected);
  });

  test('throttles on the usage limit the upstream reports', () => {
    const throttled = errorOf(failedEvent({ type: 'usage_limit_reached', message: 'slow down' }));

    expect(codexEventErrorStatus(throttled)).toBe(429);
  });
});

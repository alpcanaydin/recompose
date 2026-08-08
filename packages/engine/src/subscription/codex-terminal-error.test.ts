import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { codexTerminalErrorAnswer } from './codex-terminal-error';

const attribution = { 'x-recompose-target': 'codex-subscription' };

function errorEvent(message: string, code = 'rate_limit_exceeded'): JsonObject {
  return { type: 'error', error: { type: 'invalid_request_error', code, message } };
}

describe('a Codex stream event without an error yields no answer', () => {
  test('a text delta is not a terminal failure', async () => {
    const answer = await codexTerminalErrorAnswer(
      { type: 'response.output_text.delta', delta: 'hello' },
      'anthropic',
      attribution,
    );

    expect(answer).toBeNull();
  });

  test('a completed response is not a terminal failure', async () => {
    const answer = await codexTerminalErrorAnswer(
      { type: 'response.completed', response: { status: 'completed' } },
      'responses',
      attribution,
    );

    expect(answer).toBeNull();
  });
});

describe('a terminal Codex error is shaped for the dialect that asked', () => {
  test('the Anthropic dialect receives the failure under an error envelope', async () => {
    const answer = await codexTerminalErrorAnswer(
      errorEvent('the request was too large'),
      'anthropic',
      attribution,
      0,
    );
    const body = await answer?.json();

    expect(answer?.headers.get('content-type')).toBe('application/json');
    expect(body).toHaveProperty('type', 'error');
    expect(body).toHaveProperty('error.message');
  });

  test('another dialect receives the normalized failure without the envelope', async () => {
    const answer = await codexTerminalErrorAnswer(
      errorEvent('the request was too large'),
      'responses',
      attribution,
      0,
    );
    const body = await answer?.json();

    expect(body).not.toHaveProperty('type', 'error');
    expect(body).toHaveProperty('error.message');
  });

  test('the answer carries the attribution the crossing asked for', async () => {
    const answer = await codexTerminalErrorAnswer(
      errorEvent('the request was too large'),
      'responses',
      attribution,
      0,
    );

    expect(answer?.headers.get('x-recompose-target')).toBe('codex-subscription');
  });
});

describe('a terminal Codex error is found wherever the stream carries it', () => {
  test('a failed response event is read through its nested error', async () => {
    const answer = await codexTerminalErrorAnswer(
      {
        type: 'response.failed',
        response: { error: { type: 'server_error', code: 'internal', message: 'upstream fell' } },
      },
      'anthropic',
      attribution,
      0,
    );

    expect(answer).not.toBeNull();
    await expect(answer?.json()).resolves.toHaveProperty('type', 'error');
  });

  test('an error event without a nested error record is read whole', async () => {
    const answer = await codexTerminalErrorAnswer(
      { type: 'error', code: 'cyber_policy', message: 'refused by policy' },
      'anthropic',
      attribution,
      0,
    );

    expect(answer?.status).toBeGreaterThanOrEqual(400);
  });

  test('a failed response event without an error record yields no answer', async () => {
    const answer = await codexTerminalErrorAnswer(
      { type: 'response.failed', response: { status: 'failed' } },
      'anthropic',
      attribution,
      0,
    );

    expect(answer).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeCodexError } from './codex-errors';

const NOW = 1_700_000_000_000;

const knownFailures = [
  {
    name: 'context length',
    status: 413,
    body: {
      error: {
        message: 'context length exceeded',
        type: 'invalid_request_error',
        code: 'context_length_exceeded',
      },
    },
    type: 'invalid_request_error',
    code: 'context_too_large',
  },
  {
    name: 'thinking signature',
    status: 400,
    body: {
      error: {
        message: 'Invalid signature in thinking block',
        type: 'invalid_request_error',
        code: 'invalid_request_error',
      },
    },
    type: 'invalid_request_error',
    code: 'thinking_signature_invalid',
  },
  {
    name: 'previous response',
    status: 400,
    body: {
      error: {
        message: 'No response found for previous_response_id resp_123',
        type: 'invalid_request_error',
        code: 'previous_response_not_found',
      },
    },
    type: 'invalid_request_error',
    code: 'previous_response_not_found',
  },
  {
    name: 'authentication',
    status: 401,
    body: {
      error: {
        message: 'invalid or expired token',
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    },
    type: 'authentication_error',
    code: 'auth_unavailable',
  },
];

describe('Codex usage-limit retry metadata', () => {
  it('should use resets_in_seconds', async () => {
    const answer = await normalized(429, {
      error: { type: 'usage_limit_reached', resets_in_seconds: 123 },
    });

    expect(answer.headers.get('retry-after')).toBe('123');
  });

  it('should prefer a future resets_at', async () => {
    const answer = await normalized(429, {
      error: {
        type: 'usage_limit_reached',
        resets_at: NOW / 1000 + 300,
        resets_in_seconds: 1,
      },
    });

    expect(answer.headers.get('retry-after')).toBe('300');
  });

  it('should fall back when resets_at is past', async () => {
    const answer = await normalized(429, {
      error: {
        type: 'usage_limit_reached',
        resets_at: NOW / 1000 - 60,
        resets_in_seconds: 77,
      },
    });

    expect(answer.headers.get('retry-after')).toBe('77');
  });

  it('should not invent retry metadata for another error type', async () => {
    const answer = await normalized(429, {
      error: { type: 'rate_limit_error', resets_in_seconds: 30 },
    });

    expect(answer.headers.get('retry-after')).toBeNull();
  });
});

describe('Codex rate-limit status normalization', () => {
  it('should treat model capacity as 429 without an invented delay', async () => {
    const answer = await normalized(400, {
      error: { message: 'Selected model is at capacity. Please try a different model.' },
    });

    expect(answer.status).toBe(429);
    expect(answer.headers.get('retry-after')).toBeNull();
  });

  it('should treat nested usage_limit_reached as 429 with its reset delay', async () => {
    const answer = await normalized(400, {
      error: {
        type: 'usage_limit_reached',
        message: "You've hit your usage limit.",
        resets_in_seconds: 120,
      },
    });

    expect(answer.status).toBe(429);
    expect(answer.headers.get('retry-after')).toBe('120');
  });

  it('should treat top-level usage_limit_reached as 429', async () => {
    const answer = await normalized(400, { type: 'usage_limit_reached' });

    expect(answer.status).toBe(429);
  });
});

describe('Codex known error classification', () => {
  it.each(knownFailures)('should classify $name failures', async ({ status, body, type, code }) => {
    const answer = await normalized(status, body);

    await expect(answer.json()).resolves.toMatchObject({ error: { type, code } });
  });

  it('should name the status when a rejection carries no words at all', async () => {
    const answer = await normalizeCodexError(new Response('', { status: 401 }), NOW);

    expect(answer.status).toBe(401);
    await expect(answer.json()).resolves.toEqual({
      error: { message: 'HTTP 401', type: 'authentication_error', code: 'auth_unavailable' },
    });
  });

  it('should ignore an error message that is not a string', async () => {
    const answer = await normalized(401, { error: { message: { detail: 'nope' } } });

    await expect(answer.json()).resolves.toMatchObject({
      error: { message: '{"error":{"message":{"detail":"nope"}}}' },
    });
  });

  it('should preserve an unclassified error byte for byte', async () => {
    const body =
      '{"error":{"message":"documentation mentions too many tokens, but this is billing","type":"server_error","code":"billing_config_error"}}';
    const answer = await normalizeCodexError(
      new Response(body, { status: 502, headers: { 'content-type': 'application/json' } }),
      NOW,
    );

    expect(answer.status).toBe(502);
    await expect(answer.text()).resolves.toBe(body);
  });
});

// Helpers

async function normalized(status: number, body: unknown): Promise<Response> {
  return normalizeCodexError(
    Response.json(body, { status, headers: { 'content-type': 'application/json' } }),
    NOW,
  );
}

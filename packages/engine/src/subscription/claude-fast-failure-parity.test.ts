import { describe, expect, it, vi } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { SubscriptionAttempt } from './intercepted-send';

import { completeSubscriptionAttempt } from './attempt-completion';
import { claudeFailureScope, ClaudeRequestScopedError } from './claude-fast-failure';
import { sendInterceptedSubscription } from './intercepted-send';

describe('Claude fast credit error classification parity', () => {
  it('TestClassifyClaudeUpstreamError_FastModeCreditsIsRequestScoped', async () => {
    for (const message of [
      'Usage credits are required for fast mode.',
      'Fast mode requires usage credits',
    ]) {
      const answer = errorResponse(429, message);

      await expect(claudeFailureScope(429, answer, standardBody())).resolves.toBe('request');
      await expect(answer.clone().text()).resolves.toContain(message);
    }
  });

  it('TestClassifyClaudeUpstreamError_RealRateLimitStaysCredentialScoped', async () => {
    const answer = errorResponse(429, 'Number of requests has exceeded your rate limit.');

    await expect(claudeFailureScope(429, answer, standardBody())).resolves.toBe('credential');
  });

  it('TestClassifyClaudeUpstreamError_OtherStatusesUnaffected', async () => {
    const answer = errorResponse(500, 'Usage credits are required for fast mode.');

    await expect(claudeFailureScope(500, answer, standardBody())).resolves.toBe('credential');
  });
});

describe('Claude executor fast failure attempt parity', () => {
  it('TestClaudeExecutorFastHTTPErrorPassesThroughWithoutRetry', async () => {
    for (const status of [400, 401, 403, 429, 500, 503]) {
      const refresh = vi.fn(async () => {
        await Promise.resolve();

        return successfulAttempt();
      });
      const answer = errorResponse(status, 'Fast request rejected');
      const result = await completed(answer, fastBody(), refresh);

      expect(result.answer).toBe(answer);
      expect(result.failureScope).toBe('request');
      expect(refresh).not.toHaveBeenCalled();
    }
  });

  it('TestClaudeExecutorFastSuccessfulHTTPDecodeErrorDoesNotExposeSuccessStatus', async () => {
    const cause = new Error('invalid compressed response');

    await expect(fastTransportFailure(cause)).rejects.toMatchObject({
      name: 'ClaudeRequestScopedError',
      message: 'invalid compressed response',
    });
  });

  it('TestClaudeExecutorFastTransportErrorIsRequestScopedWithoutRetry', async () => {
    const cause = new Error('transport failed');

    await expect(fastTransportFailure(cause)).rejects.toBeInstanceOf(ClaudeRequestScopedError);
  });

  it('TestClaudeExecutorNonFastErrorKeepsCredentialScopedBehavior', async () => {
    const refresh = vi.fn(async () => {
      await Promise.resolve();

      return successfulAttempt();
    });
    const answer = errorResponse(429, 'rate limit exceeded');
    const result = await completed(answer, standardBody(), refresh);

    expect(result.answer).toBe(answer);
    expect(result.failureScope).toBe('credential');
    expect(refresh).not.toHaveBeenCalled();
    await expect(claudeFailureScope(429, answer, standardBody())).resolves.toBe('credential');
  });
});

// Helpers

function errorResponse(status: number, message: string): Response {
  return Response.json({ type: 'error', error: { type: 'rate_limit_error', message } }, { status });
}

function standardBody(): JsonObject {
  return { model: 'claude-opus-5', messages: [{ role: 'user', content: 'hello' }] };
}

function fastBody(): JsonObject {
  return { ...standardBody(), speed: 'fast' };
}

function successfulAttempt(): SubscriptionAttempt {
  return { answer: Response.json({ ok: true }), terminated: false };
}

async function completed(
  answer: Response,
  requestBody: JsonObject,
  refresh: () => Promise<SubscriptionAttempt>,
): Promise<SubscriptionAttempt> {
  return completeSubscriptionAttempt({
    attempt: { answer, terminated: false },
    provider: 'anthropic',
    credential: { accessToken: 'token', refreshToken: 'refresh' },
    requestBody,
    resend: async () => {
      await Promise.resolve();

      return successfulAttempt();
    },
    refresh,
  });
}

async function fastTransportFailure(cause: Error): Promise<SubscriptionAttempt> {
  return sendInterceptedSubscription(
    'anthropic',
    'account',
    fastBody(),
    { url: 'https://api.anthropic.com/v1/messages', headers: [], body: '{}' },
    async () => {
      await Promise.resolve();

      throw cause;
    },
  );
}

import type { SpendGrant } from '@recompose/contracts';
import type { Hono } from 'hono';

import { vi } from 'vitest';

import type { ProviderRequest } from './subscription/claude-request';

import { aVirtualModel } from './gateway-app.testkit';

export const subscriptionModel = aVirtualModel({
  target: { standing: 'bound', providerModel: 'claude-sonnet-4-5' },
});

export function subscriptionGrant(
  provider: 'anthropic' | 'openai',
  credential: string,
): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin:
      provider === 'anthropic'
        ? 'https://api.anthropic.com'
        : 'https://chatgpt.com/backend-api/codex',
    spend: {
      custody: 'subscription',
      provider,
      accountId: `acc-${provider}`,
      credential,
    },
  };
}

export function runtimeAnswering(answer: () => Response) {
  const sent: { provider: string; request: ProviderRequest }[] = [];
  const persist = vi.fn(async () => {
    await Promise.resolve();
  });

  return {
    sent,
    persist,
    runtime: {
      send: async (provider: 'anthropic' | 'openai', request: ProviderRequest) => {
        await Promise.resolve();
        sent.push({ provider, request });

        return answer();
      },
      refreshFetch: async () => {
        await Promise.resolve();

        throw new Error('no refresh expected');
      },
      persist,
      now: () => 1_700_000_000_000,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
      newClaudeDeviceId: () => '0'.repeat(64),
      fetchClaudeProfile: async () => {
        await Promise.resolve();

        return { account: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
      },
    },
  };
}

export function claudeCredential(
  accessToken: string,
  expiresAt: number,
  refreshToken = 'claude-refresh',
): string {
  return JSON.stringify({
    account_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    claude_device_ids: ['0'.repeat(64)],
    claudeAiOauth: { accessToken, refreshToken, expiresAt },
  });
}

export function codexCredential(): string {
  const accessToken = ['header', 'eyJleHAiOjE4MDAwMDAwMDB9', 'signature'].join('.');

  return JSON.stringify({
    tokens: {
      access_token: accessToken,
      refresh_token: 'codex-refresh',
      account_id: 'acct-work',
    },
  });
}

export function claudeAnswer(content: readonly unknown[] = []): Response {
  return Response.json({
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content,
    stop_reason: 'end_turn',
  });
}

export async function chatRequest(app: Hono, stream = false): Promise<Response> {
  const response = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      ...(stream ? { stream: true } : {}),
      messages: [{ role: 'user', content: 'hello' }],
    }),
  });

  return response;
}

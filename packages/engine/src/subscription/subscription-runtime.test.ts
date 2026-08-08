import { describe, expect, test, vi } from 'vitest';

import { subscriptionRuntime } from './subscription-runtime';

type WireAnswer = { headers: [string, string][]; body: string; status: number };

const wire = vi.hoisted(
  (): { answers: { headers: [string, string][]; body: string; status: number }[] } => ({
    answers: [],
  }),
);

vi.mock('node-wreq', () => ({
  fetch: async () => {
    await Promise.resolve();

    return wire.answers.shift() ?? { headers: [], body: '{}', status: 200 };
  },
}));

function queue(answer: WireAnswer): void {
  wire.answers.length = 0;
  wire.answers.push(answer);
}

describe('the subscription runtime without a credential store', () => {
  test('refuses to persist a rotated credential', async () => {
    const runtime = subscriptionRuntime();

    await expect(runtime.persist('anthropic', 'account-1', 'blob')).rejects.toThrow(
      'subscription credential persistence is unavailable',
    );
  });

  test('hands a rotated credential to the store it was built with', async () => {
    const stored: string[] = [];
    const runtime = subscriptionRuntime(async (provider, accountId, credential) => {
      stored.push(`${provider}/${accountId}/${credential}`);
      await Promise.resolve();
    });

    await runtime.persist('openai', 'account-2', 'rotated');

    expect(stored).toEqual(['openai/account-2/rotated']);
  });
});

describe('the subscription runtime mints identity', () => {
  test('gives every request its own identifier', () => {
    const runtime = subscriptionRuntime();

    expect(runtime.randomUUID()).not.toBe(runtime.randomUUID());
  });

  test('gives every pairing its own Claude device identifier', () => {
    const runtime = subscriptionRuntime();

    expect(runtime.newClaudeDeviceId()).not.toBe(runtime.newClaudeDeviceId());
  });

  test('reads the wall clock forward', () => {
    const runtime = subscriptionRuntime();
    const before = Date.now();

    expect(runtime.now()).toBeGreaterThanOrEqual(before);
  });
});

describe('the subscription runtime reaches the provider wire', () => {
  test('returns the upstream answer to a subscription send', async () => {
    const runtime = subscriptionRuntime();

    queue({ headers: [['content-type', 'application/json']], body: '{"ok":true}', status: 200 });

    const answer = await runtime.send('openai', {
      url: 'https://chatgpt.com/backend-api/codex/responses',
      headers: [['authorization', 'Bearer codex-access']],
      body: '{}',
    });

    expect(answer.status).toBe(200);
  });

  test('reads the account identity from the Claude profile', async () => {
    const runtime = subscriptionRuntime();

    queue({
      headers: [['content-type', 'application/json']],
      body: JSON.stringify({ account: { uuid: 'account-uuid-1' } }),
      status: 200,
    });

    await expect(runtime.fetchClaudeProfile('claude-access')).resolves.toEqual({
      account: { uuid: 'account-uuid-1' },
    });
  });

  test('refuses a Claude profile the provider declined', async () => {
    const runtime = subscriptionRuntime();

    queue({ headers: [], body: 'denied', status: 403 });

    await expect(runtime.fetchClaudeProfile('claude-access')).rejects.toThrow(
      'fetch Claude OAuth profile failed with status 403',
    );
  });
});

import { describe, expect, test, vi } from 'vitest';

import type { RefreshFetch } from './refresh';

import { refreshSubscriptionCredential } from './refresh';

const claudeBlob = JSON.stringify({
  claudeAiOauth: { accessToken: 'old-access', refreshToken: 'claude-deadline-token' },
});

const codexBlob = JSON.stringify({
  tokens: { access_token: 'old-access', refresh_token: 'codex-deadline-token' },
});

function failingFetch(): RefreshFetch {
  return vi.fn(async (_url: string, init: Parameters<RefreshFetch>[1]) => {
    await Promise.resolve();

    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);

    return new Response('probe', { status: 400 });
  });
}

async function expectIndependentDeadline(provider: 'anthropic' | 'openai', blob: string) {
  const timeout = vi.spyOn(AbortSignal, 'timeout');

  try {
    await expect(refreshSubscriptionCredential(provider, blob, failingFetch())).rejects.toThrow(
      /status 400/,
    );
    expect(timeout).toHaveBeenCalledWith(30_000);
  } finally {
    timeout.mockRestore();
  }
}

describe('Codex refresh deadline parity', () => {
  test('TestRefreshTokens_UsesIndependentTimeout', async () => {
    await expectIndependentDeadline('openai', codexBlob);
  });

  test('TestRefreshTokens_DeduplicatesConcurrentRefreshAcrossInstances', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchLike: RefreshFetch = vi.fn(async () => {
      await held;

      return Response.json({ access_token: 'new-access', expires_in: 3600 });
    });

    const first = refreshSubscriptionCredential('openai', codexBlob, fetchLike, 0);
    const second = refreshSubscriptionCredential('openai', codexBlob, fetchLike, 0);

    await vi.waitFor(() => {
      expect(fetchLike).toHaveBeenCalledOnce();
    });
    release?.();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchLike).toHaveBeenCalledOnce();
  });
});

describe('Claude refresh deadline parity', () => {
  test('TestRefreshTokens_UsesIndependentTimeout', async () => {
    await expectIndependentDeadline('anthropic', claudeBlob);
  });
});

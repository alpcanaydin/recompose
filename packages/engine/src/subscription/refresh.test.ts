import { describe, expect, test, vi } from 'vitest';

import { credentialNeedsRefresh, refreshSubscriptionCredential } from './refresh';
import { antigravityRefreshBlob } from './refresh.testkit';

const claudeBlob = JSON.stringify({
  claudeAiOauth: {
    accessToken: 'old-access',
    refreshToken: 'claude-refresh',
    expiresAt: 1_700_000_000_000,
    subscriptionType: 'max',
  },
});

const codexBlob = JSON.stringify({
  tokens: {
    access_token: 'old-access',
    refresh_token: 'codex-refresh',
    account_id: 'acct-work',
  },
  last_refresh: 'old-time',
});

const codexRefreshRequest = {
  method: 'POST',
  headers: [
    ['Content-Type', 'application/x-www-form-urlencoded'],
    ['Accept', 'application/json'],
  ],
  body: new URLSearchParams({
    client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
    grant_type: 'refresh_token',
    refresh_token: 'codex-refresh',
    scope: 'openid profile email',
  }).toString(),
};

const codexRotatedTokens = {
  tokens: {
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    id_token: 'new-id',
    account_id: 'acct-work',
  },
};

describe('deciding whether an access token is still fit for a turn', () => {
  test('a token expiring inside five minutes refreshes before it is spent', () => {
    expect(credentialNeedsRefresh({ accessToken: 'x', expiresAt: 1_000_299 }, 1_000_000)).toBe(
      true,
    );
  });

  test('a token with more than five minutes left is spent as it stands', () => {
    expect(credentialNeedsRefresh({ accessToken: 'x', expiresAt: 1_300_001 }, 1_000_000)).toBe(
      false,
    );
  });

  test('a token with no readable expiry is tried rather than discarded', () => {
    expect(credentialNeedsRefresh({ accessToken: 'x' }, 1_000_000)).toBe(false);
  });

  test("Antigravity uses CLIProxyAPI's fifty-minute refresh skew", () => {
    expect(
      credentialNeedsRefresh({ accessToken: 'x', expiresAt: 3_999_999 }, 1_000_000, 'antigravity'),
    ).toBe(true);
    expect(
      credentialNeedsRefresh({ accessToken: 'x', expiresAt: 4_000_001 }, 1_000_000, 'antigravity'),
    ).toBe(false);
  });
});

describe('refreshing an Antigravity OAuth credential', () => {
  test("the refresh request matches CLIProxyAPI's Google exchange", async () => {
    const blob = JSON.stringify({
      access_token: 'old-access',
      refresh_token: 'google-refresh',
      expired: '2020-01-01T00:00:00.000Z',
      project_id: 'cloud-project',
    });
    let capturedBody = '';
    const fetchLike = vi.fn(async (_url: string, init: { body: string }) => {
      await Promise.resolve();
      capturedBody = init.body;

      return Response.json({ access_token: 'new-access', expires_in: 3600 });
    });

    await refreshSubscriptionCredential('antigravity', blob, fetchLike, 1_700_000_000_000);

    expect(fetchLike).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: [
        ['Content-Type', 'application/x-www-form-urlencoded'],
        ['Accept', 'application/json'],
      ],
      body: capturedBody,
    });
    expect(new URLSearchParams(capturedBody).get('refresh_token')).toBe('google-refresh');
  });
});

describe('deduplicating Antigravity OAuth refresh', () => {
  test('shared-token refresh preserves each account project metadata', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchLike = vi.fn(async () => {
      await held;

      return Response.json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
    });
    const first = refreshSubscriptionCredential(
      'antigravity',
      antigravityRefreshBlob('project-a'),
      fetchLike,
      1_700_000_000_000,
    );
    const second = refreshSubscriptionCredential(
      'antigravity',
      antigravityRefreshBlob('project-b'),
      fetchLike,
      1_700_000_000_000,
    );

    await vi.waitFor(() => {
      expect(fetchLike).toHaveBeenCalledOnce();
    });
    release?.();

    const [firstBlob, secondBlob] = await Promise.all([first, second]);

    expect(JSON.parse(firstBlob)).toMatchObject({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      project_id: 'project-a',
    });
    expect(JSON.parse(secondBlob)).toMatchObject({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      project_id: 'project-b',
    });
    expect(fetchLike).toHaveBeenCalledOnce();
  });
});

describe('refreshing a Claude Code OAuth credential', () => {
  test('the refresh request matches the native Claude Code control-plane shape', async () => {
    const fetchLike = vi.fn(async () => {
      await Promise.resolve();

      return Response.json({ access_token: 'new-access', expires_in: 28_800 });
    });

    const refreshed = await refreshSubscriptionCredential(
      'anthropic',
      claudeBlob,
      fetchLike,
      1_700_000_000_000,
    );

    expect(fetchLike).toHaveBeenCalledWith('https://platform.claude.com/v1/oauth/token', {
      method: 'POST',
      headers: [
        ['Accept', 'application/json, text/plain, */*'],
        ['Content-Type', 'application/json'],
        ['User-Agent', 'axios/1.15.2'],
        ['Accept-Encoding', 'gzip, compress, deflate, br'],
        ['Connection', 'close'],
      ],
      body: JSON.stringify({
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
        grant_type: 'refresh_token',
        refresh_token: 'claude-refresh',
        scope:
          'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload',
      }),
    });
    expect(JSON.parse(refreshed)).toMatchObject({
      claudeAiOauth: {
        accessToken: 'new-access',
        refreshToken: 'claude-refresh',
        expiresAt: 1_700_028_800_000,
        subscriptionType: 'max',
      },
    });
  });
});

describe('deduplicating Claude Code OAuth refresh', () => {
  test('concurrent refreshes sharing a token make one upstream request', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchLike = vi.fn(async () => {
      await held;

      return Response.json({ access_token: 'new-access', expires_in: 28_800 });
    });

    const first = refreshSubscriptionCredential('anthropic', claudeBlob, fetchLike, 0);
    const second = refreshSubscriptionCredential('anthropic', claudeBlob, fetchLike, 0);

    await vi.waitFor(() => {
      expect(fetchLike).toHaveBeenCalledOnce();
    });
    release?.();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchLike).toHaveBeenCalledOnce();
  });
});

describe('rate-limiting Claude Code OAuth refresh', () => {
  test('a rate-limited refresh is not immediately replayed', async () => {
    const rateLimitedBlob = JSON.stringify({
      claudeAiOauth: {
        accessToken: 'old-access',
        refreshToken: 'rate-limited-refresh',
        expiresAt: 1_700_000_000_000,
      },
    });
    const fetchLike = vi.fn(async () => {
      await Promise.resolve();

      return new Response('slow down', { status: 429, headers: { 'Retry-After': '30' } });
    });

    await expect(
      refreshSubscriptionCredential('anthropic', rateLimitedBlob, fetchLike, 1_000),
    ).rejects.toThrow(/429/);
    await expect(
      refreshSubscriptionCredential('anthropic', rateLimitedBlob, fetchLike, 2_000),
    ).rejects.toThrow(/429/);
    expect(fetchLike).toHaveBeenCalledOnce();
  });
});

describe('refreshing a Codex OAuth credential', () => {
  test('the refresh request matches the Codex CLI token exchange', async () => {
    const fetchLike = vi.fn(async () => {
      await Promise.resolve();

      return Response.json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        id_token: 'new-id',
        expires_in: 3600,
      });
    });

    const refreshed = await refreshSubscriptionCredential(
      'openai',
      codexBlob,
      fetchLike,
      1_700_000_000_000,
    );

    expect(fetchLike).toHaveBeenCalledWith(
      'https://auth.openai.com/oauth/token',
      codexRefreshRequest,
    );
    expect(JSON.parse(refreshed)).toMatchObject(codexRotatedTokens);
  });

  test('concurrent refreshes sharing a token make one upstream request', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchLike = vi.fn(async () => {
      await held;

      return Response.json({ access_token: 'new-access', expires_in: 3600 });
    });

    const first = refreshSubscriptionCredential('openai', codexBlob, fetchLike, 0);
    const second = refreshSubscriptionCredential('openai', codexBlob, fetchLike, 0);

    await vi.waitFor(() => {
      expect(fetchLike).toHaveBeenCalledOnce();
    });

    if (release !== undefined) {
      release();
    }

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchLike).toHaveBeenCalledOnce();
  });
});

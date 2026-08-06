import type { SubscriptionProviderId } from '@recompose/contracts';

import type { ParsedSubscriptionCredential, RefreshedTokens } from './credentials';

import { isJsonObject } from '../gateway-wire';
import { parseSubscriptionCredential, refreshedCredentialBlob } from './credentials';

type RefreshRequest = {
  method: 'POST';
  headers: [string, string][];
  body: string;
};

export type RefreshFetch = (url: string, init: RefreshRequest) => Promise<Response>;

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const CLAUDE_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CLAUDE_SCOPE =
  'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';

const refreshing = new Map<string, Promise<string>>();

export function credentialNeedsRefresh(
  credential: ParsedSubscriptionCredential,
  now: number,
): boolean {
  return credential.expiresAt !== undefined && credential.expiresAt <= now + REFRESH_MARGIN_MS;
}

function refreshRequest(
  provider: SubscriptionProviderId,
  refreshToken: string,
): readonly [string, RefreshRequest] {
  if (provider === 'anthropic') {
    return [
      CLAUDE_TOKEN_URL,
      {
        method: 'POST',
        headers: [
          ['Accept', 'application/json, text/plain, */*'],
          ['Content-Type', 'application/json'],
          ['User-Agent', 'axios/1.15.2'],
          ['Accept-Encoding', 'gzip, compress, deflate, br'],
          ['Connection', 'close'],
        ],
        body: JSON.stringify({
          client_id: CLAUDE_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: CLAUDE_SCOPE,
        }),
      },
    ];
  }

  return [
    CODEX_TOKEN_URL,
    {
      method: 'POST',
      headers: [
        ['Content-Type', 'application/x-www-form-urlencoded'],
        ['Accept', 'application/json'],
      ],
      body: new URLSearchParams({
        client_id: CODEX_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'openid profile email',
      }).toString(),
    },
  ];
}

function tokenResponse(value: unknown): RefreshedTokens | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const accessToken = nonBlank(value['access_token']);
  const expiresIn = finiteNumber(value['expires_in']);

  if (accessToken === undefined || expiresIn === undefined) {
    return null;
  }

  const refreshToken = nonBlank(value['refresh_token']);
  const idToken = nonBlank(value['id_token']);

  return refreshedTokens(accessToken, expiresIn, refreshToken, idToken);
}

function refreshedTokens(
  accessToken: string,
  expiresInSeconds: number,
  refreshToken: string | undefined,
  idToken: string | undefined,
): RefreshedTokens {
  return {
    accessToken,
    expiresInSeconds,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(idToken === undefined ? {} : { idToken }),
  };
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function refreshOnce(
  provider: SubscriptionProviderId,
  blob: string,
  refreshToken: string,
  fetchLike: RefreshFetch,
  now: number,
): Promise<string> {
  const [url, init] = refreshRequest(provider, refreshToken);
  const response = await fetchLike(url, init);

  if (!response.ok) {
    throw new Error(`subscription token refresh failed with status ${String(response.status)}`);
  }

  const refreshed = tokenResponse(await response.json().catch(() => null));

  if (refreshed === null) {
    throw new Error('subscription token refresh returned a malformed response');
  }

  return refreshedCredentialBlob(provider, blob, refreshed, now);
}

export async function refreshSubscriptionCredential(
  provider: SubscriptionProviderId,
  blob: string,
  fetchLike: RefreshFetch,
  now = Date.now(),
): Promise<string> {
  const credential = parseSubscriptionCredential(provider, blob);
  const refreshToken = credential?.refreshToken;

  if (refreshToken === undefined) {
    throw new Error('subscription credential has no refresh token');
  }

  const key = `${provider}:${refreshToken}`;
  const standing = refreshing.get(key);

  if (standing !== undefined) {
    return standing;
  }

  const started = refreshOnce(provider, blob, refreshToken, fetchLike, now).finally(() => {
    refreshing.delete(key);
  });

  refreshing.set(key, started);

  return started;
}

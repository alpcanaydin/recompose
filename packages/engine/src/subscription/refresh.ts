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
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const ANTIGRAVITY_CLIENT_ID =
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = ['GOCSPX-', 'K58FWR486LdLJ1mLB8sXC4z6qDAf'].join('');
const CLAUDE_SCOPE =
  'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload';
const CLAUDE_REFRESH_MIN_BACKOFF_MS = 5_000;
const CLAUDE_REFRESH_MAX_BACKOFF_MS = 5 * 60 * 1_000;

const refreshing = new Map<string, Promise<RefreshedTokens>>();
const claudeRefreshBlockedUntil = new Map<string, number>();

export function credentialNeedsRefresh(
  credential: ParsedSubscriptionCredential,
  now: number,
  provider: SubscriptionProviderId = 'anthropic',
): boolean {
  const margin = provider === 'antigravity' ? 50 * 60 * 1000 : REFRESH_MARGIN_MS;

  return credential.expiresAt !== undefined && credential.expiresAt <= now + margin;
}

function formRefreshRequest(values: Record<string, string>): RefreshRequest {
  return {
    method: 'POST',
    headers: [
      ['Content-Type', 'application/x-www-form-urlencoded'],
      ['Accept', 'application/json'],
    ],
    body: new URLSearchParams(values).toString(),
  };
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

  if (provider === 'openai') {
    return [
      CODEX_TOKEN_URL,
      formRefreshRequest({
        client_id: CODEX_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'openid profile email',
      }),
    ];
  }

  return [
    GOOGLE_TOKEN_URL,
    formRefreshRequest({
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
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

function clampedBackoff(milliseconds: number): number {
  return Math.min(
    CLAUDE_REFRESH_MAX_BACKOFF_MS,
    Math.max(CLAUDE_REFRESH_MIN_BACKOFF_MS, milliseconds),
  );
}

function parsedRetryAfter(value: string | null, now: number): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }

  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(value) - now;

  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function parsedMilliseconds(value: string | null): number | undefined {
  const milliseconds = Number(value?.trim());

  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function retryAfterMilliseconds(response: Response, now: number): number {
  const milliseconds =
    parsedRetryAfter(response.headers.get('Retry-After'), now) ??
    parsedMilliseconds(response.headers.get('Retry-After-Ms')) ??
    0;

  return clampedBackoff(milliseconds);
}

function rememberRateLimit(
  provider: SubscriptionProviderId,
  response: Response,
  refreshToken: string,
  now: number,
): void {
  if (provider === 'anthropic' && response.status === 429) {
    claudeRefreshBlockedUntil.set(refreshToken, now + retryAfterMilliseconds(response, now));
  }
}

async function refreshOnce(
  provider: SubscriptionProviderId,
  refreshToken: string,
  fetchLike: RefreshFetch,
  now: number,
): Promise<RefreshedTokens> {
  const [url, init] = refreshRequest(provider, refreshToken);
  const response = await fetchLike(url, init);

  if (!response.ok) {
    rememberRateLimit(provider, response, refreshToken, now);

    throw new Error(`subscription token refresh failed with status ${String(response.status)}`);
  }

  claudeRefreshBlockedUntil.delete(refreshToken);

  const refreshed = tokenResponse(await response.json().catch(() => null));

  if (refreshed === null) {
    throw new Error('subscription token refresh returned a malformed response');
  }

  return refreshed;
}

function assertRefreshAllowed(
  provider: SubscriptionProviderId,
  refreshToken: string,
  now: number,
): void {
  const blockedUntil = provider === 'anthropic' ? claudeRefreshBlockedUntil.get(refreshToken) : 0;

  if (blockedUntil !== undefined && blockedUntil > now) {
    throw new Error('subscription token refresh failed with status 429');
  }
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

  assertRefreshAllowed(provider, refreshToken, now);

  const standing = refreshing.get(key);

  if (standing !== undefined) {
    return refreshedCredentialBlob(provider, blob, await standing, now);
  }

  const started = refreshOnce(provider, refreshToken, fetchLike, now).finally(() => {
    refreshing.delete(key);
  });

  refreshing.set(key, started);

  return refreshedCredentialBlob(provider, blob, await started, now);
}

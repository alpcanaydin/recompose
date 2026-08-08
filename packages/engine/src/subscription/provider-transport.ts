import type { AccountTransportPolicy, SubscriptionProviderId } from '@recompose/contracts';
import type { WreqInit } from 'node-wreq';

import { fetch as wreqFetch } from 'node-wreq';

import type { ProviderRequest } from './claude-request';
import type { RefreshFetch } from './refresh';

import { isJsonObject } from '../gateway-wire';
import { unwrapAntigravityResponse } from './antigravity-response';
import { decodeClaudeResponse } from './claude-compression';
import { restoreClaudeToolResponse } from './claude-tool-response';
import {
  CLAUDE_CIPHERS,
  CLAUDE_OAUTH_TLS_FINGERPRINT,
  CLAUDE_SIGNATURES,
  CLAUDE_TLS_FINGERPRINT,
} from './claude-transport-fingerprint';

export { CLAUDE_OAUTH_TLS_FINGERPRINT, CLAUDE_TLS_FINGERPRINT };

const CLAUDE_OAUTH_HANDSHAKE_TIMEOUT_MS = 10_000;

function proxyOptions(policy: AccountTransportPolicy | undefined): Pick<WreqInit, 'proxy'> {
  if (policy?.mode === 'direct') return { proxy: false };
  if (policy?.mode === 'proxy') return { proxy: policy.url };

  return {};
}

export function subscriptionTransportOptions(
  provider: SubscriptionProviderId,
  policy?: AccountTransportPolicy,
): WreqInit {
  if (provider === 'openai') {
    return {
      browser: { mode: 'fixed', profile: 'chrome_149', platform: 'macos' },
      disableDefaultHeaders: true,
      ...proxyOptions(policy),
    };
  }

  if (provider === 'antigravity') {
    return { http1Only: true, disableDefaultHeaders: true, ...proxyOptions(policy) };
  }

  return {
    http1Only: true,
    disableDefaultHeaders: true,
    ...proxyOptions(policy),
    tlsSessionCacheCapacity: 32,
    tlsOptions: {
      alpnProtocols: ['HTTP1'],
      minTlsVersion: 'TLS1.2',
      maxTlsVersion: 'TLS1.3',
      curvesList: 'X25519:P-256:P-384',
      cipherList: CLAUDE_CIPHERS,
      sigalgsList: CLAUDE_SIGNATURES,
      keyShares: ['X25519'],
      keySharesLimit: 1,
      sessionTicket: true,
      preSharedKey: true,
      pskDheKe: true,
      enableOcspStapling: true,
      enableSignedCertTimestamps: true,
      extensionPermutation: [...CLAUDE_TLS_FINGERPRINT.extensionTypes],
      preserveTls13CipherList: true,
    },
  };
}

type WireResponse = {
  status: number;
  statusText?: string;
  headers: Headers | Iterable<[string, string]>;
  body: ReadableStream<Uint8Array> | null;
};

export type SubscriptionWireFetch = (url: string, init: WreqInit) => Promise<WireResponse>;

export type ClaudeProfile = {
  account: { uuid: string };
};

async function decodedProviderResponse(
  provider: SubscriptionProviderId,
  response: Response,
): Promise<Response> {
  if (provider === 'anthropic') {
    return decodeClaudeResponse(response);
  }

  return provider === 'antigravity' ? unwrapAntigravityResponse(response) : response;
}

async function restoredProviderResponse(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  response: Response,
): Promise<Response> {
  return provider === 'anthropic' && request.reverseToolNames !== undefined
    ? restoreClaudeToolResponse(response, request.reverseToolNames)
    : response;
}

function webResponseFrom(upstream: WireResponse): Response {
  const headers = new Headers();

  for (const [name, value] of upstream.headers) {
    headers.append(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    ...(upstream.statusText === undefined ? {} : { statusText: upstream.statusText }),
    headers,
  });
}

function requestOptions(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  policy?: AccountTransportPolicy,
): WreqInit {
  return {
    ...subscriptionTransportOptions(provider, policy),
    method: 'POST',
    headers: request.headers,
    body: request.body,
    retry: 0,
    throwHttpErrors: false,
  };
}

function antigravityFallbackUrl(url: string): string | null {
  const parsed = new URL(url);

  if (parsed.hostname !== 'daily-cloudcode-pa.googleapis.com') {
    return null;
  }

  parsed.hostname = 'cloudcode-pa.googleapis.com';

  return parsed.toString();
}

async function antigravityWireResponse(
  request: ProviderRequest,
  fetchLike: SubscriptionWireFetch,
): Promise<WireResponse> {
  const options = requestOptions('antigravity', request);
  const fallback = antigravityFallbackUrl(request.url);

  try {
    const first = await fetchLike(request.url, options);

    return first.status === 429 && fallback !== null ? await fetchLike(fallback, options) : first;
  } catch (failure) {
    if (fallback === null) throw failure;

    return fetchLike(fallback, options);
  }
}

async function providerWireResponse(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  fetchLike: SubscriptionWireFetch,
  policy?: AccountTransportPolicy,
): Promise<WireResponse> {
  const response =
    provider === 'antigravity'
      ? await antigravityWireResponse(request, fetchLike)
      : await fetchLike(request.url, requestOptions(provider, request, policy));

  return response;
}

export async function sendSubscriptionRequest(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  fetchLike: SubscriptionWireFetch = wreqFetch,
  policy?: AccountTransportPolicy,
): Promise<Response> {
  const upstream = await providerWireResponse(provider, request, fetchLike, policy);

  const decoded = await decodedProviderResponse(provider, webResponseFrom(upstream));

  return restoredProviderResponse(provider, request, decoded);
}

function isClaudeOAuthUrl(url: string): boolean {
  const hostname = new URL(url).hostname;

  return hostname.endsWith('claude.com') || hostname.endsWith('anthropic.com');
}

export function subscriptionRefreshTransportOptions(
  url: string,
  policy?: AccountTransportPolicy,
): WreqInit {
  if (!isClaudeOAuthUrl(url)) {
    return subscriptionTransportOptions('openai', policy);
  }

  return {
    http1Only: true,
    disableDefaultHeaders: true,
    ...proxyOptions(policy),
    connectTimeout: CLAUDE_OAUTH_HANDSHAKE_TIMEOUT_MS,
    tlsSessionCacheCapacity: 8,
    tlsOptions: {
      minTlsVersion: 'TLS1.2',
      maxTlsVersion: 'TLS1.3',
      curvesList: 'X25519:P-256:P-384',
      cipherList: CLAUDE_CIPHERS,
      sigalgsList: CLAUDE_SIGNATURES,
      keyShares: ['X25519'],
      keySharesLimit: 1,
      sessionTicket: true,
      preSharedKey: true,
      pskDheKe: true,
      extensionPermutation: [...CLAUDE_OAUTH_TLS_FINGERPRINT.extensionTypes],
      preserveTls13CipherList: true,
    },
  };
}

export const subscriptionRefreshFetch: RefreshFetch = async (url, init, policy) => {
  const response = await wreqFetch(url, {
    ...subscriptionRefreshTransportOptions(url, policy),
    ...init,
    retry: 0,
    throwHttpErrors: false,
  });

  const webResponse = webResponseFrom(response);

  return isClaudeOAuthUrl(url) ? decodeClaudeResponse(webResponse) : webResponse;
};

export async function fetchClaudeProfile(
  accessToken: string,
  fetchLike: SubscriptionWireFetch = wreqFetch,
  policy?: AccountTransportPolicy,
): Promise<ClaudeProfile> {
  const upstream = await fetchLike('https://api.anthropic.com/api/oauth/profile', {
    ...subscriptionRefreshTransportOptions('https://api.anthropic.com/api/oauth/profile', policy),
    method: 'GET',
    headers: [
      ['Accept', 'application/json, text/plain, */*'],
      ['Authorization', `Bearer ${accessToken}`],
      ['Content-Type', 'application/json'],
      ['Cache-Control', 'no-cache'],
      ['User-Agent', 'axios/1.15.2'],
      ['Accept-Encoding', 'gzip, compress, deflate, br'],
      ['Connection', 'close'],
    ],
    retry: 0,
    throwHttpErrors: false,
  });
  const response = await decodeClaudeResponse(webResponseFrom(upstream));

  if (!response.ok) {
    throw new Error(`fetch Claude OAuth profile failed with status ${response.status}`);
  }

  return claudeProfileFrom(await response.json());
}

function claudeProfileFrom(value: unknown): ClaudeProfile {
  const account = isJsonObject(value) ? value['account'] : undefined;
  const uuid = isJsonObject(account) ? account['uuid'] : undefined;

  if (typeof uuid !== 'string' || uuid.trim() === '') {
    throw new Error('fetch Claude OAuth profile: response account UUID is empty');
  }

  return { account: { uuid } };
}

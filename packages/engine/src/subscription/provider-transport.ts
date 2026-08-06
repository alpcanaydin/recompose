import type { SubscriptionProviderId } from '@recompose/contracts';
import type { WreqInit } from 'node-wreq';

import { fetch as wreqFetch } from 'node-wreq';

import type { ProviderRequest } from './claude-request';
import type { RefreshFetch } from './refresh';

import { isJsonObject } from '../gateway-wire';
import { unwrapAntigravityResponse } from './antigravity-response';
import { decodeClaudeResponse } from './claude-compression';
import { restoreClaudeToolResponse } from './claude-tool-response';

export const CLAUDE_TLS_FINGERPRINT = {
  clientHelloLength: 508,
  ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49161-49171-49162-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-21,29-23-24,0',
  ja3Md5: 'd871d02cecbde59abbf8f4806134addf',
  cipherSuites: [
    4865, 4866, 4867, 49195, 49199, 49196, 49200, 52393, 52392, 49161, 49171, 49162, 49172, 156,
    157, 47, 53,
  ],
  extensionTypes: [0, 23, 65281, 10, 11, 35, 16, 5, 13, 18, 51, 45, 43, 21],
  supportedGroups: [29, 23, 24],
  signatureAlgorithms: [1027, 2052, 1025, 1283, 2053, 1281, 2054, 1537, 513],
} as const;

export const CLAUDE_OAUTH_TLS_FINGERPRINT = {
  clientHelloLength: 245,
  ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49161-49171-49162-49172-156-157-47-53,0-23-65281-10-11-35-13-51-45-43,29-23-24,0',
  ja3Md5: '203503b7023848ab87b9836c336b8e81',
  extensionTypes: [0, 23, 65281, 10, 11, 35, 13, 51, 45, 43],
} as const;

const CLAUDE_CIPHERS = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-ECDSA-AES128-SHA',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-ECDSA-AES256-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
].join(':');

const CLAUDE_SIGNATURES = [
  'ecdsa_secp256r1_sha256',
  'rsa_pss_rsae_sha256',
  'rsa_pkcs1_sha256',
  'ecdsa_secp384r1_sha384',
  'rsa_pss_rsae_sha384',
  'rsa_pkcs1_sha384',
  'rsa_pss_rsae_sha512',
  'rsa_pkcs1_sha512',
  'rsa_pkcs1_sha1',
].join(':');

export function subscriptionTransportOptions(provider: SubscriptionProviderId): WreqInit {
  if (provider === 'openai') {
    return {
      browser: { mode: 'fixed', profile: 'chrome_149', platform: 'macos' },
      disableDefaultHeaders: true,
    };
  }

  if (provider === 'antigravity') {
    return { http1Only: true, disableDefaultHeaders: true };
  }

  return {
    http1Only: true,
    disableDefaultHeaders: true,
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

export async function sendSubscriptionRequest(
  provider: SubscriptionProviderId,
  request: ProviderRequest,
  fetchLike: SubscriptionWireFetch = wreqFetch,
): Promise<Response> {
  const upstream = await fetchLike(request.url, {
    ...subscriptionTransportOptions(provider),
    method: 'POST',
    headers: request.headers,
    body: request.body,
    retry: 0,
    throwHttpErrors: false,
  });

  const decoded = await decodedProviderResponse(provider, webResponseFrom(upstream));

  return restoredProviderResponse(provider, request, decoded);
}

function isClaudeOAuthUrl(url: string): boolean {
  return new URL(url).hostname.endsWith('claude.com');
}

export function subscriptionRefreshTransportOptions(url: string): WreqInit {
  if (!isClaudeOAuthUrl(url)) {
    return subscriptionTransportOptions('openai');
  }

  return {
    http1Only: true,
    disableDefaultHeaders: true,
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

export const subscriptionRefreshFetch: RefreshFetch = async (url, init) => {
  const response = await wreqFetch(url, {
    ...subscriptionRefreshTransportOptions(url),
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
): Promise<ClaudeProfile> {
  const upstream = await fetchLike('https://api.anthropic.com/api/oauth/profile', {
    ...subscriptionRefreshTransportOptions('https://api.anthropic.com/api/oauth/profile'),
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

import { expect, test, vi } from 'vitest';

import type { ProviderRequest } from './claude-request';

import {
  CLAUDE_OAUTH_TLS_FINGERPRINT,
  CLAUDE_TLS_FINGERPRINT,
  sendSubscriptionRequest,
  subscriptionRefreshTransportOptions,
  subscriptionTransportOptions,
} from './provider-transport';

const request: ProviderRequest = {
  url: 'https://api.anthropic.com/v1/messages?beta=true',
  headers: [
    ['Accept', 'application/json'],
    ['Authorization', 'Bearer token'],
  ],
  body: '{}',
};

test('the Claude transport carries the captured 2.1.220 TLS fingerprint', () => {
  expect(CLAUDE_TLS_FINGERPRINT).toEqual({
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
  });
});

test('Claude uses HTTP/1.1 with the captured TLS controls and no injected headers', () => {
  expect(subscriptionTransportOptions('anthropic')).toMatchObject({
    http1Only: true,
    disableDefaultHeaders: true,
    tlsSessionCacheCapacity: 32,
    tlsOptions: {
      alpnProtocols: ['HTTP1'],
      minTlsVersion: 'TLS1.2',
      maxTlsVersion: 'TLS1.3',
      curvesList: 'X25519:P-256:P-384',
      keyShares: ['X25519'],
      keySharesLimit: 1,
      sessionTicket: true,
      preSharedKey: true,
      pskDheKe: true,
      enableOcspStapling: true,
      enableSignedCertTimestamps: true,
      extensionPermutation: CLAUDE_TLS_FINGERPRINT.extensionTypes,
    },
  });
});

test('the Claude OAuth transport carries the captured control-plane fingerprint', () => {
  expect(CLAUDE_OAUTH_TLS_FINGERPRINT).toEqual({
    clientHelloLength: 245,
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49161-49171-49162-49172-156-157-47-53,0-23-65281-10-11-35-13-51-45-43,29-23-24,0',
    ja3Md5: '203503b7023848ab87b9836c336b8e81',
    extensionTypes: [0, 23, 65281, 10, 11, 35, 13, 51, 45, 43],
  });
  expect(
    subscriptionRefreshTransportOptions('https://platform.claude.com/v1/oauth/token'),
  ).toMatchObject({
    http1Only: true,
    disableDefaultHeaders: true,
    tlsSessionCacheCapacity: 8,
    tlsOptions: {
      extensionPermutation: CLAUDE_OAUTH_TLS_FINGERPRINT.extensionTypes,
    },
  });
});

test('Codex uses the Chrome transport profile used for its browser-facing API', () => {
  expect(subscriptionTransportOptions('openai')).toMatchObject({
    browser: { mode: 'fixed', profile: 'chrome_149', platform: 'macos' },
    disableDefaultHeaders: true,
  });
});

test('the native transport receives the exact ordered headers and streams its response', async () => {
  const upstream = new Response('answer', {
    status: 201,
    headers: { 'content-type': 'text/event-stream' },
  });
  const fetchLike = vi.fn(async () => {
    await Promise.resolve();

    return upstream;
  });

  const response = await sendSubscriptionRequest('anthropic', request, fetchLike);

  expect(fetchLike).toHaveBeenCalledWith(request.url, {
    ...subscriptionTransportOptions('anthropic'),
    method: 'POST',
    headers: request.headers,
    body: request.body,
    retry: 0,
    throwHttpErrors: false,
  });
  expect(response.status).toBe(201);
  await expect(response.text()).resolves.toBe('answer');
});

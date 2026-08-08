import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

import { CODEX_ORIGINATOR, CODEX_USER_AGENT } from './codex-request';

const FORWARDED_HEADERS = ['Version', 'X-Codex-Turn-Metadata', 'X-Client-Request-Id'] as const;

function forwardedHeaders(source: Headers): [string, string][] {
  return FORWARDED_HEADERS.flatMap((name) => {
    const value = source.get(name);

    return value === null ? [] : [[name, value]];
  });
}

export function codexImageProviderRequest(
  providerOrigin: string,
  path: '/images/generations' | '/images/edits',
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  sourceHeaders: Headers,
  stream: boolean,
): ProviderRequest {
  const headers: [string, string][] = [
    ['Content-Type', 'application/json'],
    ['Authorization', `Bearer ${credential.accessToken}`],
    ['Accept', stream ? 'text/event-stream' : 'application/json'],
    ['User-Agent', CODEX_USER_AGENT],
    ['Connection', 'Keep-Alive'],
    ['Originator', CODEX_ORIGINATOR],
    ...forwardedHeaders(sourceHeaders),
  ];

  if (credential.accountId !== undefined) {
    headers.push(['Chatgpt-Account-Id', credential.accountId]);
  }

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}${path}`,
    headers,
    body: JSON.stringify(body),
  };
}

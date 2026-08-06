import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { claudeProviderRequest } from './claude-request';

const COUNT_BETAS = [
  'claude-code-20250219',
  'oauth-2025-04-20',
  ['interleaved', 'thinking', '2025-05-14'].join('-'),
  'context-management-2025-06-27',
  'token-counting-2024-11-01',
].join(',');

function countBody(body: string): string {
  const parsed = parsedJson(body);

  if (!isJsonObject(parsed)) {
    throw new Error('the prepared Claude count request was not an object');
  }

  delete parsed['system'];
  delete parsed['metadata'];
  delete parsed['context_management'];
  delete parsed['diagnostics'];

  return JSON.stringify(parsed);
}

function countHeaders(headers: [string, string][]): [string, string][] {
  return headers.flatMap(([name, value]) => {
    if (name === 'X-Stainless-Timeout') {
      return [];
    }

    return [[name, name === 'anthropic-beta' ? COUNT_BETAS : value]];
  });
}

export function claudeCountTokensProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  accessToken: string,
  ids: { sessionId: string; requestId: string },
): ProviderRequest {
  const prepared = claudeProviderRequest(
    providerOrigin,
    rawBody,
    accessToken,
    ids,
    undefined,
    Date.now(),
    'count-tokens',
  );

  return {
    ...prepared,
    url: `${providerOrigin.replace(/\/+$/u, '')}/v1/messages/count_tokens?beta=true`,
    body: countBody(prepared.body),
    headers: countHeaders(prepared.headers),
  };
}

import type { SpendGrant } from '@recompose/contracts';

import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from '../gateway-wire';

import { cappedGeminiOutput } from './gemini-model-limits';
import { prepareKimiReplay } from './kimi-replay-runtime';
import { kimiProviderBody } from './kimi-request';
import { xaiProviderBody } from './xai-request';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type GrantedSpend = ResolvedGrant['spend'];
const CREDENTIALED_DIALECTS = new Map<string, ProviderDialect>([
  ['anthropic', 'anthropic'],
  ['gemini', 'gemini'],
  ['xai', 'responses'],
]);

export function credentialedDialect(provider: string, source: ProxyDialect): ProviderDialect {
  const direct = CREDENTIALED_DIALECTS.get(provider);

  if (direct !== undefined) return direct;

  return provider === 'kimi' && source === 'anthropic' ? 'anthropic' : 'chat-completions';
}

export function credentialedRequestBody(
  grant: ResolvedGrant,
  crossing: Crossing,
  body: JsonObject,
): JsonObject {
  if (grant.spend.custody !== 'credentialed') return body;

  if (grant.spend.provider === 'gemini') {
    return cappedGeminiOutput(body, crossing.providerModel);
  }

  if (grant.spend.provider === 'xai') return xaiProviderBody(body, crossing);
  if (grant.spend.provider !== 'kimi') return body;

  return kimiProviderBody(
    prepareKimiReplay(crossing, body),
    crossing.providerModel,
    crossing.dialect,
  );
}

function geminiUrl(origin: string, crossing: Crossing): string {
  const action =
    crossing.raw['stream'] === true ? 'streamGenerateContent?alt=sse' : 'generateContent';

  return `${origin}/v1beta/models/${encodeURIComponent(crossing.providerModel)}:${action}`;
}

function providerPath(provider: string, crossing: Crossing): string {
  if (provider === 'anthropic') return '/v1/messages';
  if (provider === 'xai') return '/responses';
  if (provider === 'kimi' && crossing.dialect === 'anthropic') return '/v1/messages?beta=true';

  return '/v1/chat/completions';
}

export function credentialedRequestUrl(grant: ResolvedGrant, crossing: Crossing): string {
  const origin = grant.providerOrigin.replace(/\/+$/u, '');

  if (grant.spend.custody === 'credentialed' && grant.spend.provider === 'gemini') {
    return geminiUrl(origin, crossing);
  }

  const provider = grant.spend.custody === 'credentialed' ? grant.spend.provider : '';

  return `${origin}${providerPath(provider, crossing)}`;
}

function kimiBetas(client: string | undefined): string {
  const required = ['oauth-2025-04-20', ['interleaved', 'thinking', '2025-05-14'].join('-')];
  const requested =
    client
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return [...new Set([...requested, ...required])].join(',');
}

function kimiHeaders(credential: string, crossing: Crossing): Record<string, string> {
  return crossing.dialect === 'anthropic'
    ? {
        authorization: `Bearer ${credential}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': kimiBetas(crossing.anthropicBeta),
      }
    : { authorization: `Bearer ${credential}` };
}

function xaiHeaders(credential: string, crossing: Crossing): Record<string, string> {
  return {
    authorization: `Bearer ${credential}`,
    ...(crossing.sessionId === undefined ? {} : { 'x-grok-conv-id': crossing.sessionId }),
  };
}

function providerHeaders(
  provider: string,
  credential: string,
  crossing: Crossing,
): Record<string, string> {
  if (provider === 'anthropic') {
    return { 'x-api-key': credential, 'anthropic-version': '2023-06-01' };
  }

  if (provider === 'gemini') return { 'x-goog-api-key': credential };
  if (provider === 'kimi') return kimiHeaders(credential, crossing);
  if (provider === 'xai') return xaiHeaders(credential, crossing);

  return { authorization: `Bearer ${credential}` };
}

export function credentialedRequestHeaders(
  spend: GrantedSpend,
  crossing: Crossing,
): Record<string, string> {
  const shared = { 'content-type': 'application/json' };

  return spend.custody === 'credentialed'
    ? { ...shared, ...providerHeaders(spend.provider, spend.credential, crossing) }
    : shared;
}

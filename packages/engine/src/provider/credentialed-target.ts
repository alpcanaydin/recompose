import type { SpendGrant } from '@recompose/contracts';

import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from '../gateway-wire';

import { cappedGeminiOutput } from './gemini-model-limits';
import { prepareKimiReplay } from './kimi-replay-runtime';
import { kimiProviderBody } from './kimi-request';
import {
  parseVertexCredential,
  vertexHeaders,
  vertexProviderBody,
  vertexRequestUrl,
} from './vertex-request';
import { prepareXAIReplay } from './xai-replay-runtime';
import { xaiProviderBody } from './xai-request';
import { collectXAINamespaceTools } from './xai-tools';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type GrantedSpend = ResolvedGrant['spend'];
type BodyBuilder = (crossing: Crossing, body: JsonObject) => JsonObject;
type HeaderBuilder = (credential: string, crossing: Crossing) => Record<string, string>;
const CREDENTIALED_DIALECTS = new Map<string, ProviderDialect>([
  ['aistudio', 'gemini'],
  ['anthropic', 'anthropic'],
  ['gemini', 'gemini'],
  ['gemini-interactions', 'interactions'],
  ['vertex', 'gemini'],
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

  return BODY_BUILDERS.get(grant.spend.provider)?.(crossing, body) ?? body;
}

function xaiBody(crossing: Crossing, body: JsonObject): JsonObject {
  crossing.xaiNamespaceTools = collectXAINamespaceTools(body);

  return xaiProviderBody(prepareXAIReplay(crossing, body), crossing);
}

function aiStudioBody(crossing: Crossing, body: JsonObject): JsonObject {
  const generation = body['generationConfig'];
  const cleaned =
    typeof generation === 'object' && generation !== null && !Array.isArray(generation)
      ? Object.fromEntries(
          Object.entries(generation).filter(
            ([key]) => !['maxOutputTokens', 'responseMimeType', 'responseJsonSchema'].includes(key),
          ),
        )
      : generation;

  return vertexProviderBody({ ...body, generationConfig: cleaned }, crossing);
}

const BODY_BUILDERS = new Map<string, BodyBuilder>([
  ['aistudio', aiStudioBody],
  ['gemini', (crossing, body) => cappedGeminiOutput(body, crossing.providerModel)],
  ['xai', xaiBody],
  ['vertex', (crossing, body) => vertexProviderBody(body, crossing)],
  [
    'kimi',
    (crossing, body) =>
      kimiProviderBody(prepareKimiReplay(crossing, body), crossing.providerModel, crossing.dialect),
  ],
]);

function vertexUrl(origin: string, credential: string, crossing: Crossing): string | null {
  const parsed = parseVertexCredential(credential);

  return parsed === null ? null : vertexRequestUrl(origin, parsed, crossing);
}

function geminiUrl(origin: string, crossing: Crossing): string {
  const action =
    crossing.raw['stream'] === true ? 'streamGenerateContent?alt=sse' : 'generateContent';

  return `${origin}/v1beta/models/${encodeURIComponent(crossing.providerModel)}:${action}`;
}

function usesGeminiUrl(provider: string): boolean {
  return provider === 'gemini' || provider === 'aistudio';
}

function interactionsUrl(origin: string): string {
  return `${origin}/v1beta/interactions`;
}

function providerPath(provider: string, crossing: Crossing): string {
  if (provider === 'anthropic') return '/v1/messages';
  if (provider === 'xai') return '/responses';
  if (provider === 'kimi' && crossing.dialect === 'anthropic') return '/v1/messages?beta=true';

  return '/v1/chat/completions';
}

export function credentialedRequestUrl(grant: ResolvedGrant, crossing: Crossing): string {
  const origin = grant.providerOrigin.replace(/\/+$/u, '');

  if (grant.spend.custody !== 'credentialed') return `${origin}${providerPath('', crossing)}`;

  return credentialedProviderUrl(grant.spend, crossing, origin);
}

function credentialedProviderUrl(
  spend: Extract<GrantedSpend, { custody: 'credentialed' }>,
  crossing: Crossing,
  origin: string,
): string {
  if (spend.provider === 'gemini-interactions') return interactionsUrl(origin);

  if (usesGeminiUrl(spend.provider)) {
    return geminiUrl(origin, crossing);
  }

  const vertex = spend.provider === 'vertex' ? vertexUrl(origin, spend.credential, crossing) : null;

  return vertex ?? `${origin}${providerPath(spend.provider, crossing)}`;
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

function vertexCredentialHeaders(credential: string): Record<string, string> {
  const parsed = parseVertexCredential(credential);

  return parsed === null ? {} : vertexHeaders(parsed);
}

const HEADER_BUILDERS = new Map<string, HeaderBuilder>([
  ['anthropic', (credential) => ({ 'x-api-key': credential, 'anthropic-version': '2023-06-01' })],
  ['gemini', (credential) => ({ 'x-goog-api-key': credential })],
  ['gemini-interactions', (credential) => ({ 'x-goog-api-key': credential })],
  ['vertex', vertexCredentialHeaders],
  ['kimi', kimiHeaders],
  ['xai', xaiHeaders],
]);

function providerHeaders(
  provider: string,
  credential: string,
  crossing: Crossing,
): Record<string, string> {
  const built = HEADER_BUILDERS.get(provider);

  return built === undefined
    ? { authorization: `Bearer ${credential}` }
    : built(credential, crossing);
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

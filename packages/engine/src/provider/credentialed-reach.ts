import type { SpendGrant } from '@recompose/contracts';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { Crossing, JsonObject } from '../gateway-wire';
import type { PluginHost } from '../plugin-host';
import type { AIStudioRelay, RelayRequest } from './ai-studio-relay';

import { afterAuthPlugins, flattenedHeaders, headerMap } from '../plugin-after-auth';
import { reachAIStudio } from './ai-studio-request';
import {
  credentialedDialect,
  credentialedRequestBody,
  credentialedRequestHeaders,
  credentialedRequestUrl,
} from './credentialed-target';
import { observeKimiReplay } from './kimi-replay-runtime';
import { providerObservability } from './provider-observability';
import { observeXAIReplay } from './xai-replay-runtime';
import { withXaiRetryAfter } from './xai-response';
import { restoreXAIToolResponse } from './xai-tool-response';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

function requestFor(grant: ResolvedGrant, crossing: Crossing, body: JsonObject): RelayRequest {
  const normalized = credentialedRequestBody(grant, crossing, body);
  const headers =
    grant.spend.custody === 'credentialed' && grant.spend.provider === 'aistudio'
      ? { 'content-type': 'application/json' }
      : credentialedRequestHeaders(grant.spend, crossing);

  return {
    method: 'POST',
    url: credentialedRequestUrl(grant, crossing),
    headers,
    body: JSON.stringify(normalized),
  };
}

async function rawAnswer(
  grant: ResolvedGrant,
  request: RelayRequest,
  fetchLike: typeof fetch,
  aiStudio?: AIStudioRelay,
): Promise<Response> {
  if (grant.spend.custody === 'credentialed' && grant.spend.provider === 'aistudio') {
    const answer = await reachAIStudio(grant.spend.accountId, request, aiStudio);

    if (answer === null) throw new Error('wsrelay: AI Studio channel is unavailable');

    return answer;
  }

  return fetchLike(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(proxyFetchBoundMs),
  });
}

async function providerAnswer(
  grant: ResolvedGrant,
  crossing: Crossing,
  answer: Response,
): Promise<Response> {
  if (grant.spend.custody !== 'credentialed') return answer;
  if (grant.spend.provider === 'kimi') return observeKimiReplay(crossing, answer);
  if (grant.spend.provider !== 'xai') return answer;

  const decorated = await withXaiRetryAfter(answer);
  const observed = observeXAIReplay(crossing, decorated);

  return restoreXAIToolResponse(observed, crossing.xaiNamespaceTools ?? {});
}

async function interceptedRequest(
  crossing: Crossing,
  grant: ResolvedGrant,
  prepared: RelayRequest,
  plugins?: PluginHost,
): Promise<RelayRequest | Response> {
  const dialect =
    grant.spend.custody === 'credentialed'
      ? credentialedDialect(grant.spend.provider, crossing.dialect)
      : 'chat-completions';
  const intercepted = await afterAuthPlugins(
    crossing,
    dialect,
    headerMap(prepared.headers),
    new TextEncoder().encode(prepared.body),
    plugins,
  );

  return 'response' in intercepted
    ? intercepted.response
    : {
        ...prepared,
        headers: flattenedHeaders(intercepted.headers),
        body: new TextDecoder().decode(intercepted.body),
      };
}

export async function reachCredentialed(
  crossing: Crossing,
  grant: ResolvedGrant,
  body: JsonObject,
  fetchLike: typeof fetch,
  aiStudio?: AIStudioRelay,
  plugins?: PluginHost,
): Promise<Response> {
  const prepared = requestFor(grant, crossing, body);
  const request = await interceptedRequest(crossing, grant, prepared, plugins);

  if (request instanceof Response) return request;
  const spend = grant.spend;
  const span = providerObservability().start({
    provider: spend.custody === 'credentialed' ? spend.provider : 'open',
    model: crossing.providerModel,
    accountId: spend.custody === 'credentialed' ? spend.accountId : undefined,
    dialect:
      spend.custody === 'credentialed'
        ? credentialedDialect(spend.provider, crossing.dialect)
        : 'chat-completions',
    method: request.method,
    url: request.url,
    headers: new Headers(request.headers),
    body: new TextEncoder().encode(request.body),
  });
  const answer = span.observe(await rawAnswer(grant, request, fetchLike, aiStudio));

  return providerAnswer(grant, crossing, answer);
}

import type { SpendGrant } from '@recompose/contracts';

import { proxyFetchBoundMs } from '@recompose/contracts';

import type { Crossing, JsonObject } from '../gateway-wire';
import type { PluginHost } from '../plugin-host';
import type { AIStudioRelay, RelayRequest } from './ai-studio-relay';

import { afterAuthPlugins, flattenedHeaders, headerMap } from '../plugin-after-auth';
import { notePluginExecution } from '../plugin-execution-context';
import { reachAIStudio } from './ai-studio-request';
import {
  credentialedDialect,
  credentialedRequestBody,
  credentialedRequestHeaders,
  credentialedRequestUrl,
} from './credentialed-target';
import { observeKimiReplay } from './kimi-replay-runtime';
import { providerObservability, providerRequestId } from './provider-observability';
import { observeXAIReplay } from './xai-replay-runtime';
import { withXaiRetryAfter } from './xai-response';
import { filterXAIInternalSearchResponse } from './xai-search-response';
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
  const restored = restoreXAIToolResponse(decorated, crossing.xaiNamespaceTools ?? {});
  const filtered = filterXAIInternalSearchResponse(restored, crossing);

  return observeXAIReplay(crossing, filtered);
}

async function interceptedRequest(
  crossing: Crossing,
  grant: ResolvedGrant,
  prepared: RelayRequest,
  plugins?: PluginHost,
): Promise<{ bodyChanged: boolean; request: RelayRequest } | Response> {
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

  if ('response' in intercepted) return intercepted.response;

  const body = new TextDecoder().decode(intercepted.body);

  return {
    bodyChanged: body !== prepared.body,
    request: { ...prepared, headers: flattenedHeaders(intercepted.headers), body },
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
  const intercepted = await interceptedRequest(crossing, grant, prepared, plugins);

  if (intercepted instanceof Response) return intercepted;
  const request = intercepted.request;

  notePluginExecution(
    crossing,
    headerMap(request.headers),
    new TextEncoder().encode(request.body),
    intercepted.bodyChanged,
  );
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
    requestId: providerRequestId(new Headers(request.headers)),
  });
  const answer = span.observe(await rawAnswer(grant, request, fetchLike, aiStudio));

  return providerAnswer(grant, crossing, answer);
}

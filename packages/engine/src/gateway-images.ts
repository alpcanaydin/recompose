import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { SpendGrantFor, SubscriptionRuntime } from './gateway-proxy';
import type { JsonObject } from './gateway-wire';

import { type PreparedImageBody, readImageBody } from './gateway-images-body';
import { requestSessions } from './gateway-session';
import { reachXAIImage } from './provider/xai-image';
import {
  codexImageJsonResponse,
  codexImageStreamResponse,
} from './subscription/codex-image-response';
import { codexImageResponsesBody } from './subscription/codex-image-responses';
import { reachSubscription } from './subscription/reach';
import { reachCodexImage } from './subscription/reach-image';

export type ImagePath = '/images/generations' | '/images/edits';

function imageError(message: string, status: 400 | 404 = 400): Response {
  return Response.json({ error: { type: 'invalid_request_error', message } }, { status });
}

function directImageModel(model: string): string | null {
  const base = model.trim().split('/').at(-1)?.toLowerCase();

  return base === 'gpt-image-1.5' || base === 'gpt-image-2' ? base : null;
}

function codexImageGrant(grant: SpendGrant): grant is Extract<SpendGrant, { verdict: 'resolved' }> {
  return (
    grant.verdict === 'resolved' &&
    grant.spend.custody === 'subscription' &&
    grant.spend.provider === 'openai'
  );
}

function xaiImageGrant(grant: SpendGrant): grant is Extract<SpendGrant, { verdict: 'resolved' }> {
  return (
    grant.verdict === 'resolved' &&
    grant.spend.custody === 'credentialed' &&
    grant.spend.provider === 'xai'
  );
}

function providerBody(body: JsonObject, providerModel: string, stream: boolean): JsonObject {
  return stream
    ? { ...body, model: providerModel, stream: true }
    : { ...body, model: providerModel };
}

function imageAction(path: ImagePath): 'generate' | 'edit' {
  return path === '/images/generations' ? 'generate' : 'edit';
}

function streamPrefix(path: ImagePath): string {
  return path === '/images/generations' ? 'image_generation' : 'image_edit';
}

function responseFormat(body: JsonObject): string {
  return typeof body['response_format'] === 'string' ? body['response_format'] : 'b64_json';
}

async function responsesImageAnswer(
  c: Context,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  providerModel: string,
  prepared: PreparedImageBody,
  path: ImagePath,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  const body = codexImageResponsesBody(prepared.body, providerModel, imageAction(path));
  const sessions = requestSessions(c, prepared.body);
  const answer = await reachSubscription(
    grant,
    body,
    runtime,
    sessions.sessionId,
    'responses',
    sessions.replayScopeId,
  );
  const format = responseFormat(prepared.body);

  return prepared.stream
    ? codexImageStreamResponse(answer, streamPrefix(path), format)
    : codexImageJsonResponse(answer, format);
}

async function directImageAnswer(
  c: Context,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  providerModel: string,
  prepared: PreparedImageBody,
  path: ImagePath,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  return reachCodexImage(
    grant,
    path,
    providerBody(prepared.body, providerModel, prepared.stream),
    c.req.raw.headers,
    prepared.stream,
    runtime,
  );
}

async function servedImageAnswer(
  c: Context,
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  providerModel: string,
  prepared: PreparedImageBody,
  path: ImagePath,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  const direct = directImageModel(providerModel);

  return direct === null
    ? responsesImageAnswer(c, grant, providerModel, prepared, path, runtime)
    : directImageAnswer(c, grant, direct, prepared, path, runtime);
}

async function xaiImageAnswer(
  grant: Extract<SpendGrant, { verdict: 'resolved' }>,
  providerModel: string,
  prepared: PreparedImageBody,
  path: ImagePath,
  fetchLike: typeof fetch,
): Promise<Response> {
  if (grant.spend.custody !== 'credentialed')
    return imageError('The xAI image credential is missing.');

  return reachXAIImage(
    grant.providerOrigin,
    path,
    grant.spend.credential,
    providerBody(prepared.body, providerModel, prepared.stream),
    fetchLike,
  );
}

async function targetImageAnswer(
  c: Context,
  grant: SpendGrant,
  providerModel: string,
  prepared: PreparedImageBody,
  path: ImagePath,
  runtime: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response> {
  if (xaiImageGrant(grant)) return xaiImageAnswer(grant, providerModel, prepared, path, fetchLike);
  if (!codexImageGrant(grant)) return imageError('The image target has no supported credential.');

  return servedImageAnswer(c, grant, providerModel, prepared, path, runtime);
}

export async function proxyImageRequest(
  c: Context,
  gateway: EngineGateway,
  path: ImagePath,
  spendGrantFor: SpendGrantFor,
  runtime: SubscriptionRuntime,
  fetchLike: typeof fetch,
): Promise<Response> {
  const prepared = await readImageBody(c);
  const virtual = gateway.virtualModels.find((candidate) => candidate.id === prepared.model);

  if (virtual === undefined)
    return imageError(`The model "${prepared.model}" does not exist.`, 404);
  if (virtual.target.standing !== 'bound') return imageError('The image model has no target.');

  const grant = await spendGrantFor(gateway.slug, virtual.id);

  return targetImageAnswer(
    c,
    grant,
    virtual.target.providerModel,
    prepared,
    path,
    runtime,
    fetchLike,
  );
}

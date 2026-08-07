import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Context } from 'hono';

import type { SpendGrantFor, SubscriptionRuntime } from './gateway-proxy';
import type { JsonObject } from './gateway-wire';

import { readImageBody } from './gateway-images-body';
import { reachCodexImage } from './subscription/reach-image';

export type ImagePath = '/images/generations' | '/images/edits';

function imageError(message: string, status: 400 | 404 = 400): Response {
  return Response.json({ error: { type: 'invalid_request_error', message } }, { status });
}

function directImageModel(model: string): string | null {
  const base = model.trim().split('/').at(-1)?.toLowerCase() ?? '';

  return base === 'gpt-image-1.5' || base === 'gpt-image-2' ? base : null;
}

function imageGrant(grant: SpendGrant): grant is Extract<SpendGrant, { verdict: 'resolved' }> {
  return (
    grant.verdict === 'resolved' &&
    grant.spend.custody === 'subscription' &&
    grant.spend.provider === 'openai'
  );
}

function providerBody(body: JsonObject, providerModel: string, stream: boolean): JsonObject {
  return stream
    ? { ...body, model: providerModel, stream: true }
    : { ...body, model: providerModel };
}

export async function proxyImageRequest(
  c: Context,
  gateway: EngineGateway,
  path: ImagePath,
  spendGrantFor: SpendGrantFor,
  runtime: SubscriptionRuntime,
): Promise<Response> {
  const prepared = await readImageBody(c);
  const virtual = gateway.virtualModels.find((candidate) => candidate.id === prepared.model);

  if (virtual === undefined)
    return imageError(`The model "${prepared.model}" does not exist.`, 404);
  if (virtual.target.standing !== 'bound') return imageError('The image model has no target.');

  const providerModel = directImageModel(virtual.target.providerModel);

  if (providerModel === null) return imageError('The target is not a direct Codex image model.');

  const grant = await spendGrantFor(gateway.slug, virtual.id);

  if (!imageGrant(grant)) return imageError('The image target has no Codex subscription.');

  return reachCodexImage(
    grant,
    path,
    providerBody(prepared.body, providerModel, prepared.stream),
    c.req.raw.headers,
    prepared.stream,
    runtime,
  );
}

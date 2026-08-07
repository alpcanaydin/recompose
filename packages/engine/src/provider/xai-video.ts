import type { JsonObject } from '../gateway-wire';

import { normalizeXAIImageRefs } from './xai-image';
import { withXaiRetryAfter } from './xai-response';

export type XAIVideoPath = '/videos/generations' | '/videos/edits' | '/videos/extensions' | '';

type VideoRequest = { method: 'GET' | 'POST'; path: string; body?: string };

function requestId(body: JsonObject): string | undefined {
  const value = body['request_id'];

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function videoRequest(path: XAIVideoPath, body: JsonObject): VideoRequest {
  const id = path === '' ? requestId(body) : undefined;

  if (id !== undefined) return { method: 'GET', path: `/videos/${encodeURIComponent(id)}` };

  const endpoint = path === '' ? '/videos/generations' : path;

  return { method: 'POST', path: endpoint, body: JSON.stringify(normalizeXAIImageRefs(body)) };
}

function videoHeaders(
  credential: string,
  method: 'GET' | 'POST',
  idempotencyKey: string | undefined,
): Record<string, string> {
  return {
    accept: 'application/json',
    authorization: `Bearer ${credential}`,
    ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    ...(method === 'POST' && idempotencyKey !== undefined
      ? { 'x-idempotency-key': idempotencyKey }
      : {}),
  };
}

export async function reachXAIVideo(
  providerOrigin: string,
  path: XAIVideoPath,
  credential: string,
  body: JsonObject,
  idempotencyKey: string | undefined,
  fetchLike: typeof fetch,
): Promise<Response> {
  const request = videoRequest(path, body);
  const response = await fetchLike(`${providerOrigin.replace(/\/+$/u, '')}${request.path}`, {
    method: request.method,
    headers: videoHeaders(credential, request.method, idempotencyKey),
    ...(request.body === undefined ? {} : { body: request.body }),
  });

  return withXaiRetryAfter(response);
}

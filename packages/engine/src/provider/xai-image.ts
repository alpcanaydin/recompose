import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { withXaiRetryAfter } from './xai-response';

function imageUrlValue(value: unknown): unknown {
  return isJsonObject(value) && 'url' in value ? value['url'] : value;
}

function normalizedObject(value: JsonObject, preserveImagePart: boolean): JsonObject {
  if (preserveImagePart && value['type'] === 'image_url') return value;

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizedValue(item, key === 'content')]),
  );
  const imageUrl = normalized['image_url'];

  if (imageUrl === undefined) return normalized;

  const { image_url: _imageUrl, ...withoutImageUrl } = normalized;

  return {
    ...withoutImageUrl,
    url: normalized['url'] ?? imageUrlValue(imageUrl),
  };
}

function normalizedValue(value: unknown, preserveImagePart: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizedValue(item, preserveImagePart));

  return isJsonObject(value) ? normalizedObject(value, preserveImagePart) : value;
}

export function normalizeXAIImageRefs(value: unknown): unknown {
  return normalizedValue(value, false);
}

export async function reachXAIImage(
  providerOrigin: string,
  path: '/images/generations' | '/images/edits',
  credential: string,
  body: JsonObject,
  fetchLike: typeof fetch,
): Promise<Response> {
  const normalized = normalizeXAIImageRefs(body);
  const response = await fetchLike(`${providerOrigin.replace(/\/+$/u, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${credential}`,
    },
    body: JSON.stringify(normalized),
  });

  return withXaiRetryAfter(response);
}

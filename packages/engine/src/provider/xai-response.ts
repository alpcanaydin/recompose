import { isJsonObject } from '../gateway-wire';

const FREE_USAGE_EXHAUSTED = 'subscription:free-usage-exhausted';

function freeUsageExhausted(value: unknown): boolean {
  return isJsonObject(value) && value['code'] === FREE_USAGE_EXHAUSTED;
}

export async function withXaiRetryAfter(response: Response): Promise<Response> {
  if (response.status !== 429) return response;

  const body = await response
    .clone()
    .json()
    .catch(() => undefined);

  if (!freeUsageExhausted(body)) return response;

  const headers = new Headers(response.headers);

  headers.set('retry-after', String(24 * 60 * 60));

  return new Response(response.body, { status: response.status, headers });
}

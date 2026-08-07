import { expect, test } from 'vitest';

import { withXaiRetryAfter } from './xai-response';

test('free xAI usage exhaustion carries a 24-hour retry delay', async () => {
  const response = Response.json(
    { code: 'subscription:free-usage-exhausted', error: 'free usage exhausted' },
    { status: 429 },
  );
  const decorated = await withXaiRetryAfter(response);

  expect(decorated.status).toBe(429);
  expect(decorated.headers.get('retry-after')).toBe('86400');
});

test.each([
  [429, { code: 'rate_limit', error: 'too many requests' }],
  [400, { error: 'nope' }],
] as const)('does not invent retry metadata for status %s', async (status, body) => {
  const response = Response.json(body, { status });
  const decorated = await withXaiRetryAfter(response);

  expect(decorated).toBe(response);
  expect(decorated.headers.get('retry-after')).toBeNull();
});

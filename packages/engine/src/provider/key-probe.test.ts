import type { KeyCheckVerdict } from '@recompose/contracts';

import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { probeKey } from './key-probe';

const aKey = 'sk-ant-api03-1f2e3d4c';

type SentRequest = { url: string; init: RequestInit };

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

function fetchAnswering(status: number): { sent: SentRequest[]; fetchLike: typeof fetch } {
  const sent: SentRequest[] = [];

  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init: init ?? {} });

    return Promise.resolve(new Response(null, { status }));
  };

  return { sent, fetchLike };
}

function fetchRefusing(reason: Error): typeof fetch {
  return async () => Promise.reject(reason);
}

function onlyRequestOf(sent: SentRequest[]): SentRequest {
  const request = sent[0];

  if (request === undefined || sent.length !== 1) {
    throw new Error('expected exactly one request to leave the probe');
  }

  return request;
}

describe('the request the probe sends', () => {
  test('an anthropic probe asks the models list at the first-party host under its own header', async () => {
    const { sent, fetchLike } = fetchAnswering(200);

    await probeKey(fetchLike, 'anthropic', aKey);

    const request = onlyRequestOf(sent);
    const headers = new Headers(request.init.headers);

    expect(request.url).toBe('https://api.anthropic.com/v1/models');
    expect(request.init.method).toBe('GET');
    expect(headers.get('x-api-key')).toBe(aKey);
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(headers.get('authorization')).toBeNull();
  });

  test('an openai probe asks the models list at the first-party host under the bearer header', async () => {
    const { sent, fetchLike } = fetchAnswering(200);

    await probeKey(fetchLike, 'openai', aKey);

    const request = onlyRequestOf(sent);
    const headers = new Headers(request.init.headers);

    expect(request.url).toBe('https://api.openai.com/v1/models');
    expect(headers.get('authorization')).toBe(`Bearer ${aKey}`);
    expect(headers.get('x-api-key')).toBeNull();
    expect(headers.get('anthropic-version')).toBeNull();
  });

  test('a given origin substitutes for the vendor host', async () => {
    const { sent, fetchLike } = fetchAnswering(200);

    await probeKey(fetchLike, 'anthropic', aKey, 'http://127.0.0.1:8642');

    expect(onlyRequestOf(sent).url).toBe('http://127.0.0.1:8642/v1/models');
  });

  test('the call refuses redirects and rides an abort signal', async () => {
    const { sent, fetchLike } = fetchAnswering(200);

    await probeKey(fetchLike, 'openai', aKey);

    const request = onlyRequestOf(sent);

    expect(request.init.redirect).toBe('error');
    expect(request.init.signal).toBeInstanceOf(AbortSignal);
  });

  test('the key reaches the fetch exactly as the directive carried it, whitespace included', async () => {
    const { sent, fetchLike } = fetchAnswering(200);

    await probeKey(fetchLike, 'anthropic', 'sk-ant-legacy-tail\n');

    expect(JSON.stringify(onlyRequestOf(sent).init.headers)).toContain('sk-ant-legacy-tail\\n');
  });
});

describe('the folding from vendor status to verdict', () => {
  const foldingTable: [number, KeyCheckVerdict][] = [
    [200, 'authenticates'],
    [204, 'authenticates'],
    [299, 'authenticates'],
    [300, 'could-not-check'],
    [401, 'not-accepted'],
    [403, 'not-accepted'],
    [402, 'could-not-check'],
    [429, 'could-not-check'],
    [500, 'could-not-check'],
  ];

  test.each(foldingTable)('a %i from the vendor reads as %s', async (status, verdict) => {
    const report = await probeKey(fetchAnswering(status).fetchLike, 'openai', aKey);

    expect(report).toEqual({ verdict, status });
  });

  test('a thrown fetch folds to could-not-check with no status at all', async () => {
    const report = await probeKey(fetchRefusing(new TypeError('fetch failed')), 'anthropic', aKey);

    expect(report).toStrictEqual({ verdict: 'could-not-check' });
  });

  test('a refused redirect folds to could-not-check', async () => {
    const report = await probeKey(
      fetchRefusing(new TypeError('unexpected redirect')),
      'openai',
      aKey,
    );

    expect(report).toStrictEqual({ verdict: 'could-not-check' });
  });

  test.prop([fc.integer({ min: 200, max: 599 })])(
    'every status folds to one verdict, and only a 2xx authenticates',
    async (status) => {
      const report = await probeKey(fetchAnswering(status).fetchLike, 'anthropic', aKey);

      expect(report.verdict === 'authenticates').toBe(status <= 299);
      expect(report.verdict === 'not-accepted').toBe(status === 401 || status === 403);
      expect(report.status).toBe(status);
    },
  );
});

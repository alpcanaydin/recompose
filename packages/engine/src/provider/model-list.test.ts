import { modelListBoundMs } from '@recompose/contracts';
import { describe, expect, test, vi } from 'vitest';

import { listProviderModels } from './model-list';

const vendorOrigin = 'https://api.openai.com';
const credential = 'sk-ant-api03-long-secret-7f2c';

const credentialed = { custody: 'bearer', provider: 'openrouter', credential } as const;
const anthropicKey = { custody: 'provider-key', provider: 'anthropic', credential } as const;
const geminiKey = { custody: 'provider-key', provider: 'gemini', credential } as const;
const open = { custody: 'open' } as const;

const twoModels = JSON.stringify({
  data: [
    { id: 'gpt-5', object: 'model' },
    { id: 'gpt-5-mini', object: 'model' },
  ],
});

type SentRequest = { url: string; init: RequestInit };

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

function fetchAnswering(
  status: number,
  body: string | null,
): { sent: SentRequest[]; fetchLike: typeof fetch } {
  const sent: SentRequest[] = [];

  const fetchLike: typeof fetch = async (input, init) => {
    sent.push({ url: urlOf(input), init: init ?? {} });

    return Promise.resolve(new Response(body, { status }));
  };

  return { sent, fetchLike };
}

function onlyRequestOf(sent: SentRequest[]): SentRequest {
  const request = sent[0];

  if (request === undefined || sent.length !== 1) {
    throw new Error('expected exactly one request to leave the look');
  }

  return request;
}

function headersOf(request: SentRequest): Headers {
  return new Headers(request.init.headers);
}

async function verifyGeminiListing(): Promise<void> {
  const body = JSON.stringify({
    models: [{ name: 'models/gemini-3.1-pro-preview' }, { name: 'models/gemini-3-flash' }],
  });
  const { sent, fetchLike } = fetchAnswering(200, body);
  const listing = await listProviderModels(
    fetchLike,
    'https://generativelanguage.googleapis.com',
    geminiKey,
  );

  expect(onlyRequestOf(sent).url).toBe('https://generativelanguage.googleapis.com/v1beta/models');
  expect(headersOf(onlyRequestOf(sent)).get('x-goog-api-key')).toBe(credential);
  expect(listing).toEqual({
    standing: 'listed',
    modelIds: ['gemini-3.1-pro-preview', 'gemini-3-flash'],
  });
}

describe('the request the look sends', () => {
  test('the look asks the OpenAI-compatible model list at the origin it was handed', async () => {
    const { sent, fetchLike } = fetchAnswering(200, twoModels);

    await listProviderModels(fetchLike, vendorOrigin, credentialed);

    const request = onlyRequestOf(sent);

    expect(request.url).toBe('https://api.openai.com/v1/models');
    expect(request.init.method).toBe('GET');
  });

  test('the look refuses redirects and rides an abort signal that has not fired yet', async () => {
    const { sent, fetchLike } = fetchAnswering(200, twoModels);

    await listProviderModels(fetchLike, vendorOrigin, credentialed);

    const request = onlyRequestOf(sent);

    expect(request.init.redirect).toBe('error');
    expect(request.init.signal).toBeInstanceOf(AbortSignal);
    expect(request.init.signal?.aborted).toBe(false);
  });

  test('a Gemini look reads model names from the native v1beta catalog', async () => {
    await verifyGeminiListing();
  });

  test('the look gives up on the bound both processes read, rather than a private one', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    try {
      const { fetchLike } = fetchAnswering(200, twoModels);

      await listProviderModels(fetchLike, vendorOrigin, credentialed);

      expect(timeout).toHaveBeenCalledWith(modelListBoundMs);
    } finally {
      timeout.mockRestore();
    }
  });

  test('a bearer account is asked as a bearer of its own credential', async () => {
    const { sent, fetchLike } = fetchAnswering(200, twoModels);

    await listProviderModels(fetchLike, vendorOrigin, credentialed);

    expect(headersOf(onlyRequestOf(sent)).get('Authorization')).toBe(`Bearer ${credential}`);
  });

  test('an Anthropic key is asked through the header Anthropic actually reads', async () => {
    const { sent, fetchLike } = fetchAnswering(200, twoModels);

    await listProviderModels(fetchLike, 'https://api.anthropic.com', anthropicKey);

    const headers = headersOf(onlyRequestOf(sent));

    expect(headers.get('x-api-key')).toBe(credential);
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(headers.has('Authorization')).toBe(false);
  });

  test('an open account is asked with no authorization at all', async () => {
    const { sent, fetchLike } = fetchAnswering(200, twoModels);

    await listProviderModels(fetchLike, 'http://127.0.0.1:11434', open);

    expect(headersOf(onlyRequestOf(sent)).has('Authorization')).toBe(false);
    expect(headersOf(onlyRequestOf(sent)).has('x-api-key')).toBe(false);
  });
});

describe('a catalog the look could read', () => {
  test('the ids the vendor named come back in the order the vendor gave them', async () => {
    const { fetchLike } = fetchAnswering(200, twoModels);

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'listed',
      modelIds: ['gpt-5', 'gpt-5-mini'],
    });
  });

  test('a vendor serving nothing answers a listed but empty catalog', async () => {
    const { fetchLike } = fetchAnswering(200, JSON.stringify({ data: [] }));

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'listed',
      modelIds: [],
    });
  });
});

describe('a catalog the look could not read', () => {
  test('a vendor turning the credential away answers unlisted', async () => {
    const { fetchLike } = fetchAnswering(401, '{"error":"invalid api key"}');

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('a body that is not JSON answers unlisted', async () => {
    const { fetchLike } = fetchAnswering(200, '<html>gateway timeout</html>');

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('a body carrying no model array answers unlisted', async () => {
    const { fetchLike } = fetchAnswering(200, JSON.stringify({ models: ['gpt-5'] }));

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });
});

describe('a catalog entry the look could not read', () => {
  test('an entry with no id answers unlisted, rather than a catalog missing a model', async () => {
    const { fetchLike } = fetchAnswering(200, JSON.stringify({ data: [{ object: 'model' }] }));

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('an entry that is a bare id rather than a model answers unlisted', async () => {
    const { fetchLike } = fetchAnswering(200, JSON.stringify({ data: ['gpt-5'] }));

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('an entry that is nothing at all answers unlisted', async () => {
    const { fetchLike } = fetchAnswering(200, JSON.stringify({ data: [null] }));

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('a body that is the word null answers unlisted, because null is valid JSON', async () => {
    const { fetchLike } = fetchAnswering(200, 'null');

    await expect(listProviderModels(fetchLike, vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('an origin nothing answers at answers unlisted', async () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const refusing: typeof fetch = async () => Promise.reject(new TypeError('fetch failed'));

      await expect(listProviderModels(refusing, vendorOrigin, credentialed)).resolves.toEqual({
        standing: 'unlisted',
      });
    } finally {
      complaints.mockRestore();
    }
  });
});

describe('what the look says out loud', () => {
  test('a silenced look names the origin it could not read and never the credential', async () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const refusing: typeof fetch = async () => Promise.reject(new TypeError('fetch failed'));

      await listProviderModels(refusing, vendorOrigin, credentialed);

      const spoken = JSON.stringify(complaints.mock.calls);

      expect(spoken).toContain(vendorOrigin);
      expect(spoken).not.toContain('7f2c');
    } finally {
      complaints.mockRestore();
    }
  });

  test('a vendor refusal says nothing about the credential it was asked with', async () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { fetchLike } = fetchAnswering(401, '{"error":"invalid api key"}');

      await listProviderModels(fetchLike, vendorOrigin, credentialed);

      expect(JSON.stringify(complaints.mock.calls)).not.toContain('7f2c');
    } finally {
      complaints.mockRestore();
    }
  });
});

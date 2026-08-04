import { fc } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { probeRuntime } from './runtime-probe';

const ollamaAddress = 'http://127.0.0.1:11434';

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
  test('the probe asks the version endpoint at the address it was handed', async () => {
    const { sent, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');

    await probeRuntime(fetchLike, ollamaAddress);

    const request = onlyRequestOf(sent);

    expect(request.url).toBe('http://127.0.0.1:11434/api/version');
    expect(request.init.method).toBe('GET');
  });

  test('the call refuses redirects and rides an abort signal that has not fired yet', async () => {
    const { sent, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');

    await probeRuntime(fetchLike, ollamaAddress);

    const request = onlyRequestOf(sent);

    expect(request.init.redirect).toBe('error');
    expect(request.init.signal).toBeInstanceOf(AbortSignal);
    expect(request.init.signal?.aborted).toBe(false);
  });

  test('the probe sends no headers, because a local runtime asks for no credential', async () => {
    const { sent, fetchLike } = fetchAnswering(200, '{"version":"0.5.1"}');

    await probeRuntime(fetchLike, ollamaAddress);

    expect(onlyRequestOf(sent).init.headers).toBeUndefined();
  });
});

describe('the answer that reads as the runtime itself', () => {
  test('an ok answer carrying a version answers with that version', async () => {
    const reading = await probeRuntime(
      fetchAnswering(200, '{"version":"0.5.1"}').fetchLike,
      ollamaAddress,
    );

    expect(reading).toStrictEqual({ verdict: 'answers', version: '0.5.1' });
  });
});

describe('the answer that reads as a stranger on the port', () => {
  const strangerStatusTable: [number, string | null][] = [
    [204, null],
    [300, '{"version":"0.5.1"}'],
    [401, '{}'],
    [404, 'not found'],
    [500, '{"version":"0.5.1"}'],
  ];

  test.each(strangerStatusTable)(
    'a %i answer folds to unrecognized carrying the status',
    async (status, body) => {
      const reading = await probeRuntime(fetchAnswering(status, body).fetchLike, ollamaAddress);

      expect(reading).toStrictEqual({ verdict: 'unrecognized', status });
    },
  );

  const strangerBodyTable: [string, string][] = [
    ['a plain sentence rather than JSON', 'Ollama is running'],
    ['JSON with no version at all', '{"models":[]}'],
    ['a version that is not a string', '{"version":123}'],
    ['a version that is blank', '{"version":"   "}'],
    ['a body that parses as null', 'null'],
  ];

  test.each(strangerBodyTable)(
    'an ok answer carrying %s folds to unrecognized with its status',
    async (_shape, body) => {
      const reading = await probeRuntime(fetchAnswering(200, body).fetchLike, ollamaAddress);

      expect(reading).toStrictEqual({ verdict: 'unrecognized', status: 200 });
    },
  );
});

describe('the silence that reads as unreachable', () => {
  test('a thrown fetch folds to unreachable, and no status stands in for one', async () => {
    const reading = await probeRuntime(fetchRefusing(new TypeError('fetch failed')), ollamaAddress);

    expect(reading).toStrictEqual({ verdict: 'unreachable' });
  });

  test('a refused redirect folds to unreachable', async () => {
    const reading = await probeRuntime(
      fetchRefusing(new TypeError('unexpected redirect')),
      ollamaAddress,
    );

    expect(reading).toStrictEqual({ verdict: 'unreachable' });
  });

  test('a timeout folds to unreachable', async () => {
    const reading = await probeRuntime(
      fetchRefusing(new DOMException('The operation was aborted', 'TimeoutError')),
      ollamaAddress,
    );

    expect(reading).toStrictEqual({ verdict: 'unreachable' });
  });
});

describe('the folding over every answer a port can give', () => {
  test('one verdict answers each outcome, and only an ok answer carrying a version answers', async () => {
    const withoutABodyOfTheirOwn = [204, 205, 304];
    const statuses = fc
      .integer({ min: 200, max: 599 })
      .filter((status) => !withoutABodyOfTheirOwn.includes(status));
    const bodies = fc.oneof(
      fc
        .string({ minLength: 1 })
        .filter((version) => version.trim().length > 0)
        .map((version) => ({ text: JSON.stringify({ version }), version })),
      fc.integer().map((version) => ({ text: JSON.stringify({ version }), version: null })),
      fc.constant({ text: '{}', version: null }),
      fc.constant({ text: 'Ollama is running', version: null }),
    );

    await fc.assert(
      fc.asyncProperty(statuses, bodies, async (status, body) => {
        const reading = await probeRuntime(
          fetchAnswering(status, body.text).fetchLike,
          ollamaAddress,
        );

        if (status <= 299 && body.version !== null) {
          expect(reading).toStrictEqual({ verdict: 'answers', version: body.version });

          return;
        }

        expect(reading).toStrictEqual({ verdict: 'unrecognized', status });
      }),
    );
  });
});

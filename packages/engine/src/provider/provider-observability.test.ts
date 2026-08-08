import { describe, expect, it } from 'vitest';

import {
  ProviderObservability,
  providerRequestId,
  providerUsageFrom,
  type ProviderRequestLog,
} from './provider-observability';

describe('ProviderObservability request privacy', () => {
  it('should retain only allowlisted metadata in snapshots and listeners', async () => {
    const observability = new ProviderObservability();
    const heard: unknown[] = [];
    const credential = 'sk-secret-observability-sentinel';
    const prompt = 'private prompt and tool arguments';
    const request = sensitiveRequest(credential, prompt);

    observability.subscribe((record) => {
      heard.push(record);
    });
    const span = observability.start(request);

    expect(JSON.stringify(span)).not.toContain(credential);

    await span.observe(Response.json({ usage: { input_tokens: 1, output_tokens: 1 } })).text();
    const recorded = observability.snapshot()[0];
    const serialized = JSON.stringify({ recorded, heard });

    expect(recorded).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4',
      version: '2.1.0',
      media: { connection: 'direct', sessionId: 'media-session-1' },
    });
    expect(recorded?.requestIdHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(serialized).not.toMatch(new RegExp(`${credential}|${prompt}|private-signature`, 'u'));
    expect(Object.keys(recorded ?? {})).not.toEqual(
      expect.arrayContaining(['url', 'headers', 'body', 'responseHeaders', 'requestId']),
    );
  });

  it('should fingerprint an allowlisted upstream request ID without retaining response headers', async () => {
    const observability = new ProviderObservability();
    const headers = new Headers({
      'x-upstream-request-id': 'upstream-1',
      Authorization: 'Bearer response-secret',
      'set-cookie': 'session=response-secret',
    });
    const response = new Response('{}', { headers });
    const observed = observability.start(requestLog()).observe(response);

    await observed.text();
    const recorded = observability.snapshot()[0];

    expect(recorded?.upstreamRequestIdHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.stringify(recorded)).not.toContain('upstream-1');
    expect(JSON.stringify(recorded)).not.toContain('response-secret');
    expect(recorded).not.toHaveProperty('responseHeaders');
  });
});

describe('providerRequestId', () => {
  it('should select only an allowlisted outbound request ID header', () => {
    const credential = 'sk-secret-header-sentinel';
    const headers = new Headers({
      Authorization: `Bearer ${credential}`,
      'x-api-key': credential,
      'x-client-request-id': 'request-1',
    });

    expect(providerRequestId(headers)).toBe('request-1');
    expect(
      providerRequestId(new Headers({ Authorization: `Bearer ${credential}` })),
    ).toBeUndefined();
  });
});

describe('ProviderObservability timing and queueing', () => {
  it('should measure TTFT from start until the first response chunk', async () => {
    const times = [10, 55, 70];
    const observability = new ProviderObservability({ now: () => times.shift() ?? 70 });
    const response = streamedResponse(['first', 'second']);

    await observability.start(requestLog()).observe(response).text();

    expect(observability.snapshot()[0]).toMatchObject({ ttftMs: 45, durationMs: 60 });
  });

  it('should preserve explicit generate false and default omission to true', async () => {
    const observability = new ProviderObservability();

    await observability
      .start(requestLog({ generate: false }))
      .observe(Response.json({}))
      .text();
    await observability.start(requestLog()).observe(Response.json({})).text();

    expect(observability.snapshot().map(({ generate }) => generate)).toEqual([false, true]);
  });

  it('should pop the requested oldest records and preserve the remainder', async () => {
    const observability = new ProviderObservability();

    for (const model of ['one', 'two', 'three']) {
      await observability.start(requestLog({ model })).observe(Response.json({})).text();
    }

    expect(observability.popOldest(2).map(({ model }) => model)).toEqual(['one', 'two']);
    expect(observability.snapshot().map(({ model }) => model)).toEqual(['three']);
    expect(() => observability.popOldest(0)).toThrow('count must be positive');
  });
});

describe('providerUsageFrom OpenAI', () => {
  it('should parse OpenAI cache and reasoning subsets', () => {
    expect(
      providerUsageFrom(
        'responses',
        JSON.stringify({
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            input_tokens_details: { cached_tokens: 7 },
            output_tokens_details: { reasoning_tokens: 9 },
          },
        }),
      ),
    ).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      cacheReadTokens: 7,
      cacheWriteTokens: 0,
      reasoningTokens: 9,
    });
  });

  it('should read the final usage-bearing SSE frame', () => {
    const stream = [
      'data: {"choices":[{"delta":{"content":"hi"}}]}',
      'data: {"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}',
    ].join('\n\n');

    expect(providerUsageFrom('chat-completions', stream)).toMatchObject({
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
    });
  });
});

describe('providerUsageFrom Anthropic', () => {
  it('should count cache buckets independently', () => {
    expect(
      providerUsageFrom(
        'anthropic',
        JSON.stringify({
          usage: {
            input_tokens: 2,
            output_tokens: 244,
            cache_creation_input_tokens: 831,
            cache_read_input_tokens: 44_225,
            output_tokens_details: { thinking_tokens: 40 },
          },
        }),
      ),
    ).toMatchObject({ totalTokens: 45_302, reasoningTokens: 40 });
  });
});

describe('providerUsageFrom Gemini', () => {
  it('should include tool-use and thought tokens', () => {
    expect(
      providerUsageFrom(
        'gemini',
        JSON.stringify({
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 2,
            thoughtsTokenCount: 3,
            toolUsePromptTokenCount: 5,
            cachedContentTokenCount: 4,
            totalTokenCount: 20,
          },
        }),
      ),
    ).toMatchObject({
      inputTokens: 15,
      outputTokens: 2,
      totalTokens: 20,
      cacheReadTokens: 4,
      reasoningTokens: 3,
    });
  });
});

// Helpers

describe('ProviderObservability record retention', () => {
  it('should drop the oldest records once the retained count is exceeded', async () => {
    const observability = new ProviderObservability({ maxRecords: 2 });

    for (const model of ['first', 'second', 'third']) {
      await observability
        .start(requestLog({ model }))
        .observe(Response.json({ usage: { input_tokens: 1, output_tokens: 1 } }))
        .text();
    }

    expect(observability.snapshot().map(({ model }) => model)).toEqual(['second', 'third']);
  });

  it('should retain every record while the count stays within the bound', async () => {
    const observability = new ProviderObservability({ maxRecords: 3 });

    for (const model of ['first', 'second']) {
      await observability
        .start(requestLog({ model }))
        .observe(Response.json({ usage: { input_tokens: 1, output_tokens: 1 } }))
        .text();
    }

    expect(observability.snapshot().map(({ model }) => model)).toEqual(['first', 'second']);
  });
});

function requestLog(overrides: Partial<ProviderRequestLog> = {}): ProviderRequestLog {
  return {
    provider: 'openai',
    model: 'gpt-5.4',
    dialect: 'responses',
    method: 'POST',
    ...overrides,
  };
}

type SensitiveRequest = ProviderRequestLog & {
  url: string;
  headers: Headers;
  body: Uint8Array;
  signature: string;
};

function sensitiveRequest(credential: string, prompt: string): SensitiveRequest {
  const media = { connection: 'direct', sessionId: 'media-session-1', credential };

  return {
    ...requestLog({ requestId: credential, version: '2.1.0', media }),
    url: `https://api.openai.com/v1/responses?key=${credential}`,
    headers: new Headers({ Authorization: `Bearer ${credential}`, 'x-api-key': credential }),
    body: new TextEncoder().encode(prompt),
    signature: 'private-signature',
  };
}

function streamedResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => {
          controller.enqueue(encoder.encode(chunk));
        });
        controller.close();
      },
    }),
  );
}

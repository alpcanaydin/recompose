import { describe, expect, test } from 'vitest';

import type { GeminiResponse } from './gemini-wire';

import {
  normalizeGeminiWebSearchResponse,
  normalizeGeminiWebSearchStream,
} from './gemini-web-search-grounding';

const grounding = {
  webSearchQueries: ['a gateway'],
  groundingChunks: [{ web: { uri: 'https://example.test/a', title: 'A gateway' } }],
  groundingSupports: [{ segment: { startIndex: 0, endIndex: 5 }, groundingChunkIndices: [0] }],
};

function grounded(text = 'hello world'): GeminiResponse {
  return {
    responseId: 'response-1',
    modelVersion: 'gemini-3.6-flash',
    candidates: [{ content: { role: 'model', parts: [{ text }] }, groundingMetadata: grounding }],
  };
}

function partsOf(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts ?? [];
}

function spokenText(response: GeminiResponse | undefined): string {
  if (response === undefined) return '';

  return partsOf(response)
    .map((part) => part.text ?? '')
    .join('');
}

async function* streamOf(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  for (const response of responses) {
    await Promise.resolve();
    yield response;
  }
}

async function drained(source: AsyncIterable<GeminiResponse>): Promise<GeminiResponse[]> {
  const seen: GeminiResponse[] = [];

  for await (const response of source) seen.push(response);

  return seen;
}

describe('a grounded Gemini answer is rewritten into search parts', () => {
  test('the answer opens with the search the model ran', () => {
    const parts = partsOf(normalizeGeminiWebSearchResponse(grounded(), true));

    expect(parts[0]).toEqual({
      serverWebSearch: { kind: 'use', id: 'srvtoolu_response-1', input: { query: 'a gateway' } },
    });
  });

  test('the search results follow the search itself', () => {
    const parts = partsOf(normalizeGeminiWebSearchResponse(grounded(), true));

    expect(parts[1]).toHaveProperty('serverWebSearch.kind', 'result');
  });

  test('the answer reports one web search request', () => {
    const normalized = normalizeGeminiWebSearchResponse(grounded(), true);

    expect(normalized.usageMetadata).toHaveProperty('webSearchRequests', 1);
  });

  test('a search without a stated query carries no query', () => {
    const response = grounded();

    response.candidates = [{ content: { parts: [{ text: 'hello' }] }, groundingMetadata: {} }];

    const parts = partsOf(normalizeGeminiWebSearchResponse(response, true));

    expect(parts[0]).toEqual({
      serverWebSearch: { kind: 'use', id: 'srvtoolu_response-1', input: {} },
    });
  });

  test('a response identified under the snake-case field names its search', () => {
    const response: GeminiResponse = {
      response_id: 'response-2',
      candidates: [{ content: { parts: [{ text: 'hello' }] }, groundingMetadata: grounding }],
    };

    expect(partsOf(normalizeGeminiWebSearchResponse(response, true))[0]).toHaveProperty(
      'serverWebSearch.id',
      'srvtoolu_response-2',
    );
  });

  test('a response with no identifier at all names its search translated', () => {
    const response: GeminiResponse = {
      candidates: [{ content: { parts: [{ text: 'hello' }] }, groundingMetadata: grounding }],
    };

    expect(partsOf(normalizeGeminiWebSearchResponse(response, true))[0]).toHaveProperty(
      'serverWebSearch.id',
      'srvtoolu_translated',
    );
  });
});

describe('an answer the gateway must not rewrite is returned untouched', () => {
  test('web search turned off leaves the answer alone', () => {
    const response = grounded();

    expect(normalizeGeminiWebSearchResponse(response, false)).toBe(response);
  });

  test('a candidate without content is left alone', () => {
    const response: GeminiResponse = { candidates: [{ groundingMetadata: grounding }] };

    expect(normalizeGeminiWebSearchResponse(response, true)).toBe(response);
  });

  test('a candidate without grounding is left alone', () => {
    const response: GeminiResponse = { candidates: [{ content: { parts: [{ text: 'hi' }] } }] };

    expect(normalizeGeminiWebSearchResponse(response, true)).toBe(response);
  });

  test('a response with no candidates is left alone', () => {
    const response: GeminiResponse = {};

    expect(normalizeGeminiWebSearchResponse(response, true)).toBe(response);
  });
});

describe('a grounded Gemini stream is buffered into one rewritten answer', () => {
  test('web search turned off passes the stream through', async () => {
    const responses = [grounded('hello'), grounded(' world')];
    const seen = await drained(normalizeGeminiWebSearchStream(streamOf(responses), false));

    expect(seen).toHaveLength(2);
  });

  test('the stream opens with a zeroed usage frame', async () => {
    const seen = await drained(normalizeGeminiWebSearchStream(streamOf([grounded()]), true));

    expect(seen[0]).toEqual({
      responseId: 'response-1',
      modelVersion: 'gemini-3.6-flash',
      usageMetadata: { candidatesTokenCount: 0 },
    });
  });

  test('the buffered text of every frame reaches the rewritten answer', async () => {
    const responses = [grounded('hello'), grounded(' world')];
    const seen = await drained(normalizeGeminiWebSearchStream(streamOf(responses), true));

    expect(spokenText(seen[1])).toBe('hello world');
  });

  test('an empty stream yields nothing', async () => {
    expect(await drained(normalizeGeminiWebSearchStream(streamOf([]), true))).toEqual([]);
  });

  test('a stream whose last frame has no candidate yields nothing', async () => {
    const seen = await drained(normalizeGeminiWebSearchStream(streamOf([{}]), true));

    expect(seen).toEqual([]);
  });

  test('a frame without an identifier opens without one', async () => {
    const response: GeminiResponse = {
      candidates: [{ content: { parts: [{ text: 'hi' }] }, groundingMetadata: grounding }],
    };
    const seen = await drained(normalizeGeminiWebSearchStream(streamOf([response]), true));

    expect(seen[0]).toEqual({ usageMetadata: { candidatesTokenCount: 0 } });
  });
});

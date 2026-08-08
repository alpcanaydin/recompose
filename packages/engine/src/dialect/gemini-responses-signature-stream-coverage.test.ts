import { describe, expect, test } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';

import { normalizeGeminiResponsesTextStream } from './gemini-responses-signature-stream';

async function* streamed(responses: readonly GeminiResponse[]) {
  await Promise.resolve();

  for (const response of responses) yield response;
}

async function normalized(responses: readonly GeminiResponse[]): Promise<GeminiResponse[]> {
  const collected: GeminiResponse[] = [];

  for await (const response of normalizeGeminiResponsesTextStream(streamed(responses))) {
    collected.push(response);
  }

  return collected;
}

function textsOf(response: GeminiResponse | undefined): (string | undefined)[] {
  const parts = response === undefined ? [] : partsOf(response);

  return parts.map((part) => part.text);
}

function partsOf(response: GeminiResponse): readonly GeminiPart[] {
  const candidate = response.candidates?.[0];

  return candidate?.content?.parts ?? [];
}

describe('normalizing a Gemini chunk that carries no content', () => {
  test('a chunk naming no candidate is forwarded exactly as it arrived', async () => {
    const usageOnly = { usageMetadata: { totalTokenCount: 5 } } satisfies GeminiResponse;

    const responses = await normalized([usageOnly]);

    expect(responses).toStrictEqual([usageOnly]);
  });
});

describe('normalizing a held-back Gemini turn the next chunk cannot join', () => {
  test('a multi-part turn is released whole when the next text will not merge', async () => {
    const held = {
      candidates: [
        {
          content: {
            parts: [{ text: 'weighing', thought: true }, { text: 'hello' }],
          },
        },
      ],
    } satisfies GeminiResponse;
    const closing = {
      candidates: [{ content: { parts: [{ text: ' world' }] }, finishReason: 'STOP' }],
    } satisfies GeminiResponse;

    const responses = await normalized([held, closing]);

    expect(responses).toHaveLength(2);
    expect(textsOf(responses[0])).toStrictEqual(['weighing', 'hello']);
    expect(textsOf(responses[1])).toStrictEqual([' world']);
  });
});

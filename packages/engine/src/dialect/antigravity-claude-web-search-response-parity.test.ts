import { describe, expect, it } from 'vitest';

import type { AnthropicStreamEvent } from './anthropic-wire';
import type { GeminiGroundingMetadata, GeminiResponse } from './gemini-wire';

import { translateResponseFromGemini, translateStreamFromGemini } from './gemini-bridge';
import { citedGroundingParts, webSearchResultsFromGrounding } from './gemini-web-search-grounding';

describe('Antigravity Claude non-stream web-search grounding', () => {
  it('TestConvertAntigravityResponseToClaudeNonStream_WebSearchGrounding', () => {
    const response = translatedResponse(true);

    expect(response.content[0]).toHaveProperty('type', 'server_tool_use');
    expect(response.content[1]).toHaveProperty('type', 'web_search_tool_result');
    expect(response.content[1]).toHaveProperty('content.0.url', 'https://example.com/weather');
    expect(response.content[2]).toHaveProperty('citations.0.url', 'https://example.com/weather');
    expect(response.usage).toHaveProperty('server_tool_use.web_search_requests', 1);
  });

  it('TestConvertAntigravityResponseToClaudeNonStream_WebSearchGroundingRequiresNativeGoogleSearch', () => {
    const response = translatedResponse(false);

    expect(response.content[0]).not.toHaveProperty('type', 'server_tool_use');
    expect(response.usage).not.toHaveProperty('server_tool_use');
  });
});

describe('Antigravity Claude streaming web-search grounding', () => {
  it('TestConvertAntigravityResponseToClaudeStream_WebSearchGrounding', async () => {
    const events = await streamEvents([groundingResponse()], true);

    expect(blockStartTypes(events)).toEqual(['server_tool_use', 'web_search_tool_result', 'text']);
    expect(
      events.some(
        (event) =>
          event.type === 'content_block_delta' &&
          'delta' in event &&
          event.delta.type === 'citations_delta',
      ),
    ).toBe(true);
    expect(events.at(-1)?.type).toBe('message_stop');
  });

  it('TestConvertAntigravityResponseToClaudeStream_WebSearchBuffersTextUntilGrounding', async () => {
    const events = await streamEvents(
      [responseWithText('Beijing weather '), groundingResponse('is clear today.')],
      true,
    );

    expect(blockStartTypes(events).slice(0, 2)).toEqual([
      'server_tool_use',
      'web_search_tool_result',
    ]);
    expect(streamedText(events)).toContain('Beijing weather is clear today.');
  });

  it('TestConvertAntigravityResponseToClaudeStream_WebSearchMessageStartOutputTokensZero', async () => {
    const events = await streamEvents([groundingResponse()], true);
    const start = events.find((event) => event.type === 'message_start');

    expect(start).toHaveProperty('message.usage.output_tokens', 0);
  });
});

describe('Antigravity Claude grounding helpers', () => {
  it('TestWebSearchResultsFromGrounding_DeduplicatesAndSkipsEmptyURLs', () => {
    const results = webSearchResultsFromGrounding({
      groundingChunks: [
        { web: { uri: 'https://example.com/a', title: 'A' } },
        { web: { uri: 'https://example.com/b', title: 'B' } },
        { web: { uri: 'https://example.com/a', title: 'duplicate' } },
        { web: { uri: '', title: 'empty' } },
      ],
    });

    expect(results.map((result) => result['url'])).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('TestBuildWebSearchCitedTextBlocks_TrimsOverlappingGroundingSupports', () => {
    const { text, parts } = overlappingCitationParts();

    expect(joinedText(parts)).toBe(text);
    expect(partText(parts, 1)).toBe('，气温19到31度');
    expect(citedText(parts, 1)).toBe(partText(parts, 1));
  });
});

function overlappingCitationParts() {
  const first = '北京今天晴';
  const second = '北京今天晴，气温19到31度';
  const text = `${second}。`;
  const parts = citedGroundingParts(text, {
    groundingChunks: [{ web: { uri: 'https://example.com/weather', title: 'Weather' } }],
    groundingSupports: [
      support(0, Buffer.byteLength(first)),
      support(0, Buffer.byteLength(second)),
    ],
  });

  return { text, parts };
}

function joinedText(parts: ReturnType<typeof citedGroundingParts>): string {
  return parts.map((part) => part.text).join('');
}

function partText(parts: ReturnType<typeof citedGroundingParts>, index: number) {
  return parts[index]?.text;
}

function citedText(parts: ReturnType<typeof citedGroundingParts>, index: number): unknown {
  return parts[index]?.citations?.[0]?.['cited_text'];
}

function translatedResponse(native: boolean) {
  const translated = translateResponseFromGemini(
    'anthropic',
    groundingResponse(),
    {},
    {
      nativeWebSearch: native,
    },
  );

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));
  if ('outcome' in translated) throw new Error('unexpected passthrough');

  return translated.value;
}

async function streamEvents(
  responses: GeminiResponse[],
  nativeWebSearch: boolean,
): Promise<AnthropicStreamEvent[]> {
  const events: AnthropicStreamEvent[] = [];

  for await (const event of translateStreamFromGemini(
    'anthropic',
    sourceOf(responses),
    {},
    { nativeWebSearch },
  )) {
    events.push(event);
  }

  return events;
}

async function* sourceOf(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  await Promise.resolve();

  for (const response of responses) yield response;
}

function blockStartTypes(events: AnthropicStreamEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === 'content_block_start' && 'content_block' in event
      ? [event.content_block.type]
      : [],
  );
}

function streamedText(events: AnthropicStreamEvent[]): string {
  return events
    .flatMap((event) =>
      event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta'
        ? [event.delta.text]
        : [],
    )
    .join('');
}

function groundingResponse(text = 'Beijing weather is clear today.'): GeminiResponse {
  return {
    responseId: 'resp-web-search',
    modelVersion: 'gemini-3.1-flash-lite',
    candidates: [
      {
        content: { parts: [{ text }] },
        groundingMetadata: groundingMetadata(),
        finishReason: 'STOP',
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6, totalTokenCount: 16 },
  };
}

function responseWithText(text: string): GeminiResponse {
  return {
    responseId: 'resp-web-search',
    modelVersion: 'gemini-3.1-flash-lite',
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 },
  };
}

function groundingMetadata(): GeminiGroundingMetadata {
  return {
    webSearchQueries: ['Beijing weather'],
    groundingChunks: [{ web: { uri: 'https://example.com/weather', title: 'Beijing Weather' } }],
    groundingSupports: [support(0, 31)],
  };
}

function support(startIndex: number, endIndex: number) {
  return {
    segment: { startIndex, endIndex },
    groundingChunkIndices: [0],
  };
}

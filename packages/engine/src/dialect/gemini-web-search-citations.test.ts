import { describe, expect, test } from 'vitest';

import type { GeminiGroundingMetadata } from './gemini-wire';

import { webSearchResultsFromGrounding } from './gemini-web-search-citations';

function chunk(
  uri: string | undefined,
  title?: string,
): { web?: { uri?: string; title?: string } } {
  return {
    web: { ...(uri === undefined ? {} : { uri }), ...(title === undefined ? {} : { title }) },
  };
}

function grounding(chunks: GeminiGroundingMetadata['groundingChunks']): GeminiGroundingMetadata {
  return chunks === undefined ? {} : { groundingChunks: chunks };
}

describe('a Gemini grounding chunk becomes a web search result', () => {
  test('a chunk with a URI and a title is carried whole', () => {
    const results = webSearchResultsFromGrounding(
      grounding([chunk('https://example.test/a', 'A gateway')]),
    );

    expect(results).toEqual([
      {
        type: 'web_search_result',
        title: 'A gateway',
        url: 'https://example.test/a',
        page_age: null,
      },
    ]);
  });

  test('a chunk without a title is carried under an empty title', () => {
    const results = webSearchResultsFromGrounding(grounding([chunk('https://example.test/a')]));

    expect(results[0]).toHaveProperty('title', '');
  });

  test('a URI is trimmed before it is carried', () => {
    const results = webSearchResultsFromGrounding(
      grounding([chunk('  https://example.test/a  ', 'A gateway')]),
    );

    expect(results[0]).toHaveProperty('url', 'https://example.test/a');
  });

  test('metadata without grounding chunks yields no results', () => {
    expect(webSearchResultsFromGrounding({})).toEqual([]);
  });

  test('an empty chunk list yields no results', () => {
    expect(webSearchResultsFromGrounding(grounding([]))).toEqual([]);
  });
});

describe('a Gemini grounding chunk the hub cannot cite is dropped', () => {
  test('a chunk without a web reference is dropped', () => {
    expect(webSearchResultsFromGrounding(grounding([{}]))).toEqual([]);
  });

  test('a chunk without a URI is dropped', () => {
    expect(webSearchResultsFromGrounding(grounding([chunk(undefined, 'A gateway')]))).toEqual([]);
  });

  test('a chunk whose URI is blank is dropped', () => {
    expect(webSearchResultsFromGrounding(grounding([chunk('   ', 'A gateway')]))).toEqual([]);
  });

  test('a URI repeated across chunks is carried once', () => {
    const results = webSearchResultsFromGrounding(
      grounding([
        chunk('https://example.test/a', 'First'),
        chunk('https://example.test/a', 'Second'),
      ]),
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('title', 'First');
  });

  test('distinct URIs are all carried', () => {
    const results = webSearchResultsFromGrounding(
      grounding([chunk('https://example.test/a'), chunk('https://example.test/b')]),
    );

    expect(results).toHaveLength(2);
  });
});

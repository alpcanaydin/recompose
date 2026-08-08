import { describe, expect, test } from 'vitest';

import type { GeminiGroundingMetadata } from './gemini-wire';

import { citedGroundingParts } from './gemini-web-search-citations';

type Support = NonNullable<GeminiGroundingMetadata['groundingSupports']>[number];
type Chunk = NonNullable<GeminiGroundingMetadata['groundingChunks']>[number];

const chunks: Chunk[] = [
  { web: { uri: 'https://example.test/a', title: 'A gateway' } },
  { web: { uri: 'https://example.test/b', title: 'B gateway' } },
];

function support(startIndex: number, endIndex: number, indices: number[] = [0]): Support {
  return { segment: { startIndex, endIndex }, groundingChunkIndices: indices };
}

function metadata(supports: Support[], grounding: Chunk[] = chunks): GeminiGroundingMetadata {
  return { groundingChunks: grounding, groundingSupports: supports };
}

describe('grounded Gemini text is split into cited and uncited parts', () => {
  test('a support cites its own span and leaves the lead-in plain', () => {
    const parts = citedGroundingParts('hello world', metadata([support(6, 11)]));

    expect(parts[0]).toEqual({ text: 'hello ' });
    expect(parts[1]).toHaveProperty('text', 'world');
  });

  test('the citation names the source it came from', () => {
    const parts = citedGroundingParts('hello world', metadata([support(6, 11)]));

    expect(parts[1]).toHaveProperty('citations', [
      {
        type: 'web_search_result_location',
        cited_text: 'world',
        url: 'https://example.test/a',
        title: 'A gateway',
      },
    ]);
  });

  test('text after the last support is carried plain', () => {
    const parts = citedGroundingParts('hello world again', metadata([support(0, 5)]));

    expect(parts.at(-1)).toEqual({ text: ' world again' });
  });

  test('a second source appears under the first title it grounds', () => {
    const parts = citedGroundingParts('hello world', metadata([support(6, 11, [1])]));

    expect(parts[1]).toHaveProperty('citations.0.url', 'https://example.test/b');
  });
});

describe('ungrounded Gemini text stays whole', () => {
  test('text without supports is carried as a single part', () => {
    expect(citedGroundingParts('hello world', metadata([]))).toEqual([{ text: 'hello world' }]);
  });

  test('empty text yields no parts', () => {
    expect(citedGroundingParts('', metadata([]))).toEqual([]);
  });

  test('metadata without supports at all carries the text whole', () => {
    expect(citedGroundingParts('hello world', {})).toEqual([{ text: 'hello world' }]);
  });
});

describe('a Gemini support the hub cannot place is skipped', () => {
  test('a support without a segment is skipped', () => {
    const parts = citedGroundingParts('hello world', metadata([{ groundingChunkIndices: [0] }]));

    expect(parts).toEqual([{ text: 'hello world' }]);
  });

  test('a support without a start index is skipped', () => {
    const value: Support = { segment: { endIndex: 5 }, groundingChunkIndices: [0] };

    expect(citedGroundingParts('hello world', metadata([value]))).toEqual([
      { text: 'hello world' },
    ]);
  });

  test('a support without an end index is skipped', () => {
    const value: Support = { segment: { startIndex: 0 }, groundingChunkIndices: [0] };

    expect(citedGroundingParts('hello world', metadata([value]))).toEqual([
      { text: 'hello world' },
    ]);
  });

  test('a support already covered by an earlier one is skipped', () => {
    const parts = citedGroundingParts('hello world', metadata([support(0, 11), support(0, 5)]));

    expect(parts).toHaveLength(1);
  });
});

describe('a Gemini support without a usable source is carried uncited', () => {
  test('a support naming no chunks carries the span without citations', () => {
    const parts = citedGroundingParts('hello world', metadata([support(6, 11, [])]));

    expect(parts[1]).toHaveProperty('citations', []);
  });

  test('a support naming a chunk that does not exist carries no citation', () => {
    const parts = citedGroundingParts('hello world', metadata([support(6, 11, [9])]));

    expect(parts[1]).toHaveProperty('citations', []);
  });

  test('a support naming a chunk without a web reference carries no citation', () => {
    const parts = citedGroundingParts('hello world', metadata([support(6, 11, [0])], [{}]));

    expect(parts[1]).toHaveProperty('citations', []);
  });

  test('a support naming a chunk without a URI carries no citation', () => {
    const grounding = [{ web: { title: 'A gateway' } }];
    const parts = citedGroundingParts('hello world', metadata([support(6, 11, [0])], grounding));

    expect(parts[1]).toHaveProperty('citations', []);
  });

  test('a chunk without a title cites under an empty title', () => {
    const grounding = [{ web: { uri: 'https://example.test/a' } }];
    const parts = citedGroundingParts('hello world', metadata([support(6, 11, [0])], grounding));

    expect(parts[1]).toHaveProperty('citations.0.title', '');
  });

  test('metadata with supports but no chunks carries no citation', () => {
    const parts = citedGroundingParts('hello world', {
      groundingSupports: [support(6, 11, [0])],
    });

    expect(parts[1]).toHaveProperty('citations', []);
  });
});

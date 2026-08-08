import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { extractCodexImageResults } from './codex-image-results';

function image(result: string, outputFormat: string): JsonObject {
  return { type: 'image_generation_call', result, output_format: outputFormat };
}

function completed(createdAt: number, output?: JsonObject[]): JsonObject {
  return {
    type: 'response.completed',
    response: { created_at: createdAt, ...(output === undefined ? {} : { output }) },
  };
}

function completedWith(output: readonly unknown[]): JsonObject {
  return { type: 'response.completed', response: { created_at: 999, output } };
}

function completedResponse(response: JsonObject): JsonObject {
  return { type: 'response.completed', response };
}

const unusableEntries: [string, unknown][] = [
  ['an output entry of another type', { type: 'message', role: 'assistant' }],
  ['an output entry that is not a record', 'not an item'],
  ['an image call whose result is blank', { type: 'image_generation_call', result: '   ' }],
  ['an image call whose result is not text', { type: 'image_generation_call', result: 42 }],
];

const timestampGaps: [string, JsonObject][] = [
  ['the response carries no creation timestamp', {}],
  ['the response reports a zero creation timestamp', { created_at: 0 }],
];

const usageGaps: [string, JsonObject][] = [
  ['tool usage is not a record', { tool_usage: 'none' }],
  ['the image_gen entry is not a record', { tool_usage: { image_gen: 3 } }],
];

describe('extractCodexImageResults', () => {
  test('extracts a completed image and its metadata', () => {
    const extraction = extractCodexImageResults(completed(111, [image('AAA', 'png')]));

    expect(extraction.createdAt).toBe(111);
    expect(extraction.results).toHaveLength(1);
    expect(extraction.results[0]?.result).toBe('AAA');
    expect(extraction.firstMeta?.outputFormat).toBe('png');
  });

  test('orders collected fallback items by output index', () => {
    const indexed = new Map([
      [2, image('SECOND', 'png')],
      [0, image('FIRST', 'jpg')],
    ]);
    const extraction = extractCodexImageResults(completed(222, []), indexed);

    expect(extraction.results.map((result) => result.result)).toEqual(['FIRST', 'SECOND']);
  });

  test('prefers non-empty completed output over collected items', () => {
    const indexed = new Map([[0, image('FROM_ITEMS', 'png')]]);
    const extraction = extractCodexImageResults(
      completed(333, [image('FROM_OUTPUT', 'png')]),
      indexed,
    );

    expect(extraction.results.map((result) => result.result)).toEqual(['FROM_OUTPUT']);
  });

  test('rejects a non-completed event', () => {
    expect(() => extractCodexImageResults({ type: 'response.in_progress' })).toThrow(
      'unexpected event type',
    );
  });

  test('uses unindexed fallback items and keeps their metadata', () => {
    const extraction = extractCodexImageResults(completed(444), new Map(), [image('FB', 'webp')]);

    expect(extraction.results.map((result) => result.result)).toEqual(['FB']);
    expect(extraction.firstMeta?.outputFormat).toBe('webp');
  });
});

describe('an output entry that carries no image is left out', () => {
  test.each(unusableEntries)('%s is skipped', (_label, entry) => {
    const extraction = extractCodexImageResults(completedWith([entry, image('KEPT', 'png')]));

    expect(extraction.results.map((result) => result.result)).toEqual(['KEPT']);
  });

  test('an extraction that produced nothing reports no first metadata', () => {
    const extraction = extractCodexImageResults(completedWith([{ type: 'reasoning' }]));

    expect(extraction.results).toEqual([]);
    expect(extraction).not.toHaveProperty('firstMeta');
  });

  test('a metadata field that is not text reads as empty', () => {
    const extraction = extractCodexImageResults(
      completedWith([{ type: 'image_generation_call', result: 'AAA', size: 512 }]),
    );

    expect(extraction.firstMeta?.size).toBe('');
    expect(extraction.firstMeta?.quality).toBe('');
  });
});

describe('an extraction is dated by the response or by the clock', () => {
  test.each(timestampGaps)('falls back to the wall clock when %s', (_label, response) => {
    const extraction = extractCodexImageResults(
      completedResponse({ ...response, output: [image('AAA', 'png')] }),
      new Map(),
      [],
      () => 1_700_000_000_500,
    );

    expect(extraction.createdAt).toBe(1_700_000_000);
  });

  test('rejects a completed event whose response record is missing', () => {
    expect(() => extractCodexImageResults({ type: 'response.completed' })).toThrow(
      'completed response is missing',
    );
  });
});

describe('an extraction carries the image usage the response reported', () => {
  test('an image_gen usage record rides along with the results', () => {
    const extraction = extractCodexImageResults(
      completedResponse({
        created_at: 1,
        output: [image('AAA', 'png')],
        tool_usage: { image_gen: { images: 2 } },
      }),
    );

    expect(extraction.usage).toEqual({ images: 2 });
  });

  test.each(usageGaps)('no usage is reported when %s', (_label, extra) => {
    const extraction = extractCodexImageResults(
      completedResponse({ created_at: 1, output: [image('AAA', 'png')], ...extra }),
    );

    expect(extraction).not.toHaveProperty('usage');
  });
});

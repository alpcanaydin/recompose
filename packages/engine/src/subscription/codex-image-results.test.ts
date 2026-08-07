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

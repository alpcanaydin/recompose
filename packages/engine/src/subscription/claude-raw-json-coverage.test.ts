import { describe, expect, test } from 'vitest';

import { applyClaudeRawJsonEdits, remapClaudeToolNamesRaw } from './claude-raw-json';

const SECRET = 'remap-secret';

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decoded(body: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(body));
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('applying raw edits to a Claude request body', () => {
  test('returns the body untouched when no edit is requested', () => {
    const body = bytes('{"name":"Read"}');

    expect(applyClaudeRawJsonEdits(body, [])).toBe(body);
  });

  test('deletes a span when an edit carries no replacement', () => {
    const edited = applyClaudeRawJsonEdits(bytes('abcdef'), [{ start: 2, end: 4 }]);

    expect(new TextDecoder().decode(edited ?? new Uint8Array())).toBe('abef');
  });

  test.each([
    ['an edit that starts before the body', [{ start: -1, end: 2 }]],
    ['an edit that ends past the body', [{ start: 0, end: 99 }]],
    ['an edit that ends before it starts', [{ start: 3, end: 1 }]],
    [
      'edits that overlap one another',
      [
        { start: 0, end: 4 },
        { start: 2, end: 5 },
      ],
    ],
  ])('refuses %s', (_label, edits) => {
    expect(applyClaudeRawJsonEdits(bytes('abcdef'), edits)).toBeNull();
  });
});

describe('remapping Claude tool names in a raw body', () => {
  test('aliases a tool declared with a primitive name', () => {
    const remapped = remapClaudeToolNamesRaw(encoded({ tools: [{ name: 7 }] }), SECRET);
    const aliases = Object.values(remapped.reverse);

    expect(remapped.fallback).toBe(false);
    expect(aliases).toEqual(['7']);
    expect(JSON.stringify(decoded(remapped.body))).not.toContain('"name":7');
  });

  test.each([
    ['null', null, 'null'],
    ['a boolean', true, 'true'],
  ])('aliases a tool named with %s', (_label, name, original) => {
    const remapped = remapClaudeToolNamesRaw(encoded({ tools: [{ name }] }), SECRET);

    expect(Object.values(remapped.reverse)).toEqual([original]);
  });

  test('leaves a tool declared with a name of an unsupported shape alone', () => {
    const remapped = remapClaudeToolNamesRaw(
      encoded({ tools: [{ name: { nested: true } }] }),
      SECRET,
    );

    expect(remapped.reverse).toEqual({});
    expect(remapped.fallback).toBe(false);
  });

  test('leaves a body that declares no tools unchanged', () => {
    const body = encoded({ messages: [{ role: 'user', content: 'hello' }] });
    const remapped = remapClaudeToolNamesRaw(body, SECRET);

    expect(remapped.reverse).toEqual({});
    expect(decoded(remapped.body)).toEqual({ messages: [{ role: 'user', content: 'hello' }] });
  });

  test('falls back to a scan when the body is not a JSON object', () => {
    const remapped = remapClaudeToolNamesRaw(bytes('[{"name":"Read"}]'), SECRET);

    expect(remapped.fallback).toBe(true);
    expect(Object.values(remapped.reverse)).toEqual(['Read']);
  });

  test('leaves already namespaced tool names untouched during a fallback scan', () => {
    const remapped = remapClaudeToolNamesRaw(bytes('[{"name":"mcp__exa__search"}]'), SECRET);

    expect(remapped.reverse).toEqual({});
    expect(new TextDecoder().decode(remapped.body)).toContain('mcp__exa__search');
  });
});

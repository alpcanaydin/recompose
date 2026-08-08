import { describe, expect, test } from 'vitest';

import { duplicateJsonKey } from './json-duplicates';

describe('duplicate JSON key detection', () => {
  test.each([
    ['top-level metadata', '{"metadata":{},"metadata":{}}', 'metadata'],
    ['nested user id', '{"metadata":{"user_id":"a","user_id":"b"}}', 'user_id'],
    ['escaped equivalent', '{"metadata":{},"meta\\u0064ata":{}}', 'metadata'],
    ['array member', '{"messages":[{"role":"user","role":"assistant"}]}', 'role'],
  ])('finds %s', (_name, body, key) => {
    expect(duplicateJsonKey(body)).toBe(key);
  });

  test.each([
    '{}',
    '{"metadata":{"user_id":"{}"}}',
    '{"left":{"id":1},"right":{"id":2}}',
    '{"messages":[{"role":"user"},{"role":"assistant"}]}',
  ])('accepts unique keys in %s', (body) => {
    expect(duplicateJsonKey(body)).toBeUndefined();
  });
});

function nested(depth: number): string {
  return `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`;
}

describe('scanning bodies the JSON grammar does not describe', () => {
  test('a truncated body whose key reads as a number finds no duplicate', () => {
    expect(duplicateJsonKey('{12')).toBeUndefined();
  });

  test('a value ending before the closing brace finds no duplicate', () => {
    expect(duplicateJsonKey('{"a":123,"b":true}')).toBeUndefined();
  });

  test('nesting past the scanner ceiling is reported as its own fault', () => {
    expect(duplicateJsonKey(nested(300))).toBe('<nesting-limit>');
  });

  test('nesting within the scanner ceiling is scanned to the bottom', () => {
    expect(duplicateJsonKey(nested(50))).toBeUndefined();
  });
});

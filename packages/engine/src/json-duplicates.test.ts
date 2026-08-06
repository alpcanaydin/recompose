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

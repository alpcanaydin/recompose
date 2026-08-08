import { describe, expect, test } from 'vitest';

import { normalizeClaudeCchInputRaw } from './claude-cch-raw';

function normalized(text: string): string | null {
  const output = normalizeClaudeCchInputRaw(new TextEncoder().encode(text));

  return output === null ? null : new TextDecoder().decode(output);
}

describe('Claude signing input normalization', () => {
  test('a body that is not JSON cannot be normalized', () => {
    expect(normalized('not json at all')).toBeNull();
    expect(normalized('{"unterminated": ')).toBeNull();
  });

  test('the model name is emptied while the rest of the body stands', () => {
    expect(normalized('{"model":"claude-opus-5","stream":true}')).toBe(
      '{"model":"","stream":true}',
    );
  });

  test('an empty nested object is carried through untouched', () => {
    expect(normalized('{"model":"claude-opus-5","metadata":{}}')).toBe(
      '{"model":"","metadata":{}}',
    );
  });

  test('an empty nested list is carried through untouched', () => {
    expect(normalized('{"model":"claude-opus-5","tools":[]}')).toBe('{"model":"","tools":[]}');
  });

  test('the excluded fields are cut out wherever they sit in the body', () => {
    expect(normalized('{"max_tokens":10,"model":"claude-opus-5"}')).toBe('{"model":""}');
    expect(normalized('{"model":"claude-opus-5","max_tokens":10}')).toBe('{"model":""}');
    expect(normalized('{"a":1,"fallbacks":[1],"fallback_credit_token":"t","b":2}')).toBe(
      '{"a":1,"b":2}',
    );
  });

  test('an excluded field is cut however deeply it sits', () => {
    expect(normalized('{"metadata":{"max_tokens":10}}')).toBe('{"metadata":{}}');
  });

  test('an object already cut away is never searched for further exclusions', () => {
    expect(normalized('{"fallbacks":{"max_tokens":1},"stream":true}')).toBe('{"stream":true}');
  });

  test('a model field that is not text keeps its value', () => {
    expect(normalized('{"model":null,"stream":true}')).toBe('{"model":null,"stream":true}');
  });

  test('a body wrapped in whitespace is normalized all the same', () => {
    expect(normalized('  {"model":"claude-opus-5"}  ')).toBe('  {"model":""}  ');
  });

  test('a body that is not an object is carried through untouched', () => {
    expect(normalized('[1,2,3]')).toBe('[1,2,3]');
    expect(normalized('"plain"')).toBe('"plain"');
  });

  test('multi-byte text keeps its byte boundaries when the model name is emptied', () => {
    expect(normalized('{"system":"café ☕","model":"claude-opus-5"}')).toBe(
      '{"system":"café ☕","model":""}',
    );
  });
});

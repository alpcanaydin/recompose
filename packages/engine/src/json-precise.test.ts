import { describe, expect, it } from 'vitest';

import { isRawJsonValue, parsePreciseJson } from './json-precise';

describe('parsePreciseJson', () => {
  it('should preserve unsafe integers as raw JSON number tokens', () => {
    const parsed = parsePreciseJson(
      '{"safe":42,"large_identity":9223372036854775807,"text":"9223372036854775807"}',
    );

    expect(parsed).toHaveProperty('safe', 42);
    expect(parsed).toHaveProperty('text', '9223372036854775807');
    expect(JSON.stringify(parsed)).toBe(
      '{"safe":42,"large_identity":9223372036854775807,"text":"9223372036854775807"}',
    );
  });

  it('should expose preserved values as raw JSON objects', () => {
    const parsed = parsePreciseJson('{"large_identity":9223372036854775807}');

    if (typeof parsed !== 'object' || parsed === null || !('large_identity' in parsed)) {
      throw new Error('precise JSON object is missing');
    }

    expect(isRawJsonValue(parsed.large_identity)).toBe(true);
  });
});

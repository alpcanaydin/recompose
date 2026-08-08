import { afterEach, describe, expect, it } from 'vitest';

import { isRawJsonValue, parsePreciseJson } from './json-precise';

const engineRawJson: unknown = Reflect.get(JSON, 'rawJSON');
const engineIsRawJson: unknown = Reflect.get(JSON, 'isRawJSON');

function restoreEngineRawJson(name: string, value: unknown): void {
  Reflect.defineProperty(JSON, name, { value, writable: true, configurable: true });
}

function withoutEngineRawJson(): void {
  Reflect.deleteProperty(JSON, 'rawJSON');
  Reflect.deleteProperty(JSON, 'isRawJSON');
}

afterEach(() => {
  restoreEngineRawJson('rawJSON', engineRawJson);
  restoreEngineRawJson('isRawJSON', engineIsRawJson);
});

describe('an engine without raw JSON support', () => {
  it('should hand back the unsafe integer as its literal text', () => {
    withoutEngineRawJson();

    const parsed = parsePreciseJson('{"large_identity":9223372036854775807}');

    expect(parsed).toHaveProperty('large_identity', '9223372036854775807');
  });

  it('should report no value as raw JSON', () => {
    withoutEngineRawJson();

    expect(isRawJsonValue('9223372036854775807')).toBe(false);
  });
});

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

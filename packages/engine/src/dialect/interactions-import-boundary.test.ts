import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));
const productionModules = [
  'interactions-content.ts',
  'interactions-request-options.ts',
  'interactions-request-encode.ts',
  'interactions-request.ts',
  'interactions-response.ts',
  'interactions-stream-encode.ts',
  'interactions-stream.ts',
  'interactions-wire.ts',
];

describe('Interactions translator import boundary', () => {
  it('should not import Gemini translator modules', () => {
    const violations = productionModules.filter((file) => {
      const source = readFileSync(join(directory, file), 'utf8');

      return /from ['"]\.\/gemini/u.test(source);
    });

    expect(violations).toEqual([]);
  });
});

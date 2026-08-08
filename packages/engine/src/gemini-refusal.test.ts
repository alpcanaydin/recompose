import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { geminiRefusal } from './gemini-refusal';

const statuses: [number, string][] = [
  [404, 'NOT_FOUND'],
  [403, 'PERMISSION_DENIED'],
  [500, 'INTERNAL'],
  [503, 'INTERNAL'],
  [400, 'INVALID_ARGUMENT'],
  [429, 'INVALID_ARGUMENT'],
];

describe('a gateway refusal reaches Gemini in its own vocabulary', () => {
  test.each(statuses)('status %i is named %s', (status, name) => {
    expect(geminiRefusal(status, 'the target declined')).toEqual({
      error: { code: status, message: 'the target declined', status: name },
    });
  });

  test('the refusal repeats the code and message it was given', () => {
    const refusal = geminiRefusal(418, 'the gateway is a teapot');

    expect(refusal.error.code).toBe(418);
    expect(refusal.error.message).toBe('the gateway is a teapot');
  });

  test.prop([fc.integer({ min: 500, max: 599 })])('every server fault reads INTERNAL', (status) => {
    expect(geminiRefusal(status, 'upstream fell').error.status).toBe('INTERNAL');
  });

  test.prop([fc.integer({ min: 405, max: 499 })])(
    'other client faults read INVALID_ARGUMENT',
    (status) => {
      expect(geminiRefusal(status, 'the request was malformed').error.status).toBe(
        'INVALID_ARGUMENT',
      );
    },
  );
});

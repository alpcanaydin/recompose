import { describe, expect, test } from 'vitest';

import { isAIAPIPath, requestIdForAIPath } from './gateway-ai-path';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;

const SERVED = [
  '/v1',
  '/v1/chat/completions',
  '/v1alpha/models',
  '/v1beta/models',
  '/openai/v1/responses',
  '/backend-api/codex',
  '/backend-api/codex/responses',
];

const UNSERVED = ['/', '/health', '/v2/chat/completions', '/v1betax/models', '/backend-api/other'];

describe('recognizing the AI API surface', () => {
  test('every public model path is served', () => {
    expect(SERVED.filter(isAIAPIPath)).toStrictEqual(SERVED);
  });

  test('management and unknown paths are not part of the AI surface', () => {
    expect(UNSERVED.filter(isAIAPIPath)).toStrictEqual([]);
  });
});

describe('the request identifier an AI call is traced by', () => {
  test('a path outside the AI surface is never traced', () => {
    expect(requestIdForAIPath('/health', 'req-1')).toBeUndefined();
  });

  test('an identifier the caller supplied is kept', () => {
    expect(requestIdForAIPath('/v1/chat/completions', 'req-1')).toBe('req-1');
  });

  test('a caller that supplies none is given a fresh identifier', () => {
    expect(requestIdForAIPath('/v1/chat/completions')).toMatch(UUID);
  });

  test('a blank identifier is replaced by a fresh one', () => {
    expect(requestIdForAIPath('/v1/chat/completions', '   ')).toMatch(UUID);
    expect(requestIdForAIPath('/v1/chat/completions', '')).toMatch(UUID);
  });

  test('two calls that supply nothing are traced apart', () => {
    const first = requestIdForAIPath('/backend-api/codex/responses');
    const second = requestIdForAIPath('/backend-api/codex/responses');

    expect(first).not.toBe(second);
  });
});

import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { normalizeAntigravityFunctionHistory } from './antigravity-function-history';

function normalized(contents: unknown): unknown {
  const request: JsonObject = { contents };

  normalizeAntigravityFunctionHistory(request);

  return request['contents'];
}

function callPart(id: string, name: string): JsonObject {
  return { functionCall: { id, name } };
}

function responsePart(value: JsonObject): JsonObject {
  return { functionResponse: value };
}

describe('Antigravity function history shapes it cannot read', () => {
  test('a request without a contents list is left as it stands', () => {
    const request: JsonObject = { model: 'gemini-3-pro' };

    normalizeAntigravityFunctionHistory(request);

    expect(request).toEqual({ model: 'gemini-3-pro' });
  });

  test('entries that are not content objects travel through untouched', () => {
    expect(normalized(['raw entry', 7])).toEqual(['raw entry', 7]);
  });

  test('content without a parts list travels through untouched', () => {
    expect(normalized([{ role: 'user' }, { role: 'user', parts: 'none' }])).toEqual([
      { role: 'user' },
      { role: 'user', parts: 'none' },
    ]);
  });

  test('parts that are not objects are ignored while the rest is read', () => {
    expect(
      normalized([{ role: 'model', parts: ['raw part', callPart('read-abc-123', 'read_file')] }]),
    ).toEqual([{ role: 'model', parts: ['raw part', callPart('read-abc-123', 'read_file')] }]);
  });
});

describe('Antigravity function response repair', () => {
  test('a nameless response borrows the name recorded for its call', () => {
    const result = normalized([
      { role: 'model', parts: [callPart('read-abc-123', 'read_file')] },
      { role: 'user', parts: [responsePart({ id: 'read-abc-123', response: {} })] },
    ]);

    expect(result).toHaveProperty('1', {
      role: 'model',
      parts: [responsePart({ id: 'read-abc-123', response: {}, name: 'read_file' })],
    });
  });

  test('a response whose call was never seen falls back to the stem of its identifier', () => {
    const result = normalized([
      { role: 'user', parts: [responsePart({ id: 'read-file-abc-123', name: 'unknown' })] },
    ]);

    expect(result).toHaveProperty('0', {
      role: 'model',
      parts: [responsePart({ id: 'read-file-abc-123', name: 'read-file' })],
    });
  });

  test('a call carrying neither identifier nor name cannot be paired with a response', () => {
    const result = normalized([
      { role: 'model', parts: [{ functionCall: { name: '' } }] },
      { role: 'user', parts: [responsePart({ id: '', name: '' })] },
    ]);

    expect(result).toHaveProperty('1', {
      role: 'model',
      parts: [responsePart({ id: '', name: '' })],
    });
  });
});

describe('Antigravity pending call runs', () => {
  test('a turn of ordinary content ends the run of unanswered calls', () => {
    const result = normalized([
      { role: 'model', parts: [callPart('read-abc-123', 'read_file')] },
      { role: 'model', parts: [{ text: 'still thinking' }, { thought: true }] },
      { role: 'user', parts: [responsePart({ id: 'read-abc-123', response: {} })] },
    ]);

    expect(result).toHaveProperty('2.role', 'model');
  });

  test('an entry that is not content clears the run of unanswered calls', () => {
    const result = normalized([
      { role: 'model', parts: [callPart('read-abc-123', 'read_file')] },
      'raw entry',
      { role: 'user', parts: [responsePart({ id: 'read-abc-123', response: {} })] },
    ]);

    expect(result).toHaveProperty('1', 'raw entry');
    expect(result).toHaveProperty('2.role', 'model');
  });
});

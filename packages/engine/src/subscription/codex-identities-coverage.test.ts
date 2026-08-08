import { describe, expect, test } from 'vitest';

import { boundedCodexCallId, sanitizeCodexReasoningBody } from './codex-identities';

const longId = 'a'.repeat(80);

describe('bounding the call id Codex accepts', () => {
  test('a short call id stays as it is', () => {
    expect(boundedCodexCallId('call_1')).toBe('call_1');
  });

  test('a call id past the ceiling keeps a stable digest suffix', () => {
    const bounded = boundedCodexCallId(longId);

    expect(bounded).toHaveLength(64);
    expect(bounded).toBe(boundedCodexCallId(longId));
  });

  test('a call id that is not text passes through untouched', () => {
    expect(boundedCodexCallId(7)).toBe(7);
  });
});

describe('sanitizing the reasoning Codex may not replay', () => {
  test('a body whose input is not a list passes through untouched', () => {
    const body = { input: 'hello' };

    expect(sanitizeCodexReasoningBody(body)).toBe(body);
  });

  test('a body whose entries need no repair passes through untouched', () => {
    const body = { input: [{ type: 'message', role: 'user' }] };

    expect(sanitizeCodexReasoningBody(body)).toBe(body);
  });

  test('an input entry that is not an object survives the pass', () => {
    const body = { input: ['stray', { type: 'reasoning', encrypted_content: 'nonsense' }] };

    expect(sanitizeCodexReasoningBody(body)).toMatchObject({
      input: ['stray', { type: 'reasoning' }],
    });
  });

  test('an unstored reasoning entry loses both its identity and its payload', () => {
    expect(
      sanitizeCodexReasoningBody({
        input: [{ type: 'reasoning', id: 'rs_1', encrypted_content: 'nonsense' }],
      }),
    ).toEqual({ input: [{ type: 'reasoning' }] });
  });

  test('a stored reasoning entry keeps its identity and loses only its payload', () => {
    expect(
      sanitizeCodexReasoningBody({
        store: true,
        input: [{ type: 'reasoning', id: 'rs_1', encrypted_content: 'nonsense' }],
      }),
    ).toEqual({ store: true, input: [{ type: 'reasoning', id: 'rs_1' }] });
  });
});

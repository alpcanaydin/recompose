import { describe, expect, test } from 'vitest';

import type { ReplayTurn } from './codex-replay-turns';

import { insertReplayTurns } from './codex-replay-insert';

function assistantSaying(content: unknown): unknown {
  return { type: 'message', role: 'assistant', content };
}

function reasoning(signature: string): Record<string, unknown> {
  return { type: 'reasoning', summary: [], content: null, encrypted_content: signature };
}

function turn(overrides: Partial<ReplayTurn>): ReplayTurn {
  return { reasoning: [], calls: [], callIds: [], ...overrides };
}

describe('anchoring a replayed Codex turn that names no call and no text', () => {
  test('it lands on the last assistant message that actually said something', () => {
    const input = [
      assistantSaying('the answer'),
      assistantSaying([]),
      assistantSaying(42),
      assistantSaying([{ type: 'output_text' }]),
      { type: 'message', role: 'user', content: 'and again?' },
    ];

    const result = insertReplayTurns(input, [turn({ reasoning: [reasoning('sig-1')] })]);

    expect(result).toHaveLength(6);
    expect(result[0]).toStrictEqual(reasoning('sig-1'));
    expect(result[1]).toStrictEqual(assistantSaying('the answer'));
  });

  test('it lands on the first item that is not framing when nobody has spoken', () => {
    const input = [{ role: 'system', content: 'rules' }, 'loose-entry', { role: 'user' }];

    const result = insertReplayTurns(input, [turn({ reasoning: [reasoning('sig-2')] })]);

    expect(result[1]).toStrictEqual(reasoning('sig-2'));
    expect(result[2]).toBe('loose-entry');
  });

  test('it lands after the preamble when the conversation holds only framing', () => {
    const input = [
      { role: 'system', content: 'rules' },
      { role: 'developer', content: 'more' },
    ];

    const result = insertReplayTurns(input, [turn({ reasoning: [reasoning('sig-3')] })]);

    expect(result).toStrictEqual([...input, reasoning('sig-3')]);
  });
});

describe('replaying against reasoning the client already holds', () => {
  test('a turn whose reasoning is already present inserts nothing', () => {
    const input = ['loose-entry', reasoning('plain-text'), assistantSaying('hello')];

    const result = insertReplayTurns(input, [
      turn({ assistantText: 'hello', reasoning: [reasoning('plain-text')] }),
    ]);

    expect(result).toStrictEqual(input);
  });
});

describe('replaying a call the client never answered', () => {
  test('a call with no identifier is left out while its reasoning still lands', () => {
    const input = [assistantSaying([{ type: 'output_text', text: 'hi' }])];

    const result = insertReplayTurns(input, [
      turn({
        assistantText: 'hi',
        calls: [{ type: 'function_call', name: 'Read' }],
        reasoning: [reasoning('sig-4')],
      }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toStrictEqual(reasoning('sig-4'));
  });
});

describe('replaying a turn whose anchor is ambiguous', () => {
  test('an unmatched fingerprint with two equally good anchors inserts nothing', () => {
    const input = [assistantSaying('same answer'), assistantSaying('same answer')];

    const result = insertReplayTurns(input, [
      turn({
        assistantText: 'same answer',
        reasoning: [reasoning('sig-5')],
        requestFingerprint: 'a-fingerprint-no-prefix-produces',
      }),
    ]);

    expect(result).toStrictEqual(input);
  });
});

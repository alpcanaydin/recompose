import { describe, expect, test } from 'vitest';

import { codexReplayPrefixFingerprint, replayTurnFrom } from './codex-replay-turns';

const signedReasoning = {
  type: 'reasoning',
  id: 'rs_1',
  summary: ['thought'],
  encrypted_content: 'sealed-blob',
};

const toolCall = {
  type: 'function_call',
  call_id: 'call_1',
  name: 'read_file',
  arguments: '{}',
};

function assistantMessage(content: unknown): Record<string, unknown> {
  return { type: 'message', role: 'assistant', content };
}

describe('Codex replay turn capture', () => {
  test('output that is not a list yields no replay turn', () => {
    expect(replayTurnFrom('finished')).toBeUndefined();
    expect(replayTurnFrom(undefined)).toBeUndefined();
  });

  test('output holding nothing worth replaying yields no replay turn', () => {
    expect(replayTurnFrom([assistantMessage('done')])).toBeUndefined();
  });

  test('reasoning without a sealed blob is not worth replaying', () => {
    expect(replayTurnFrom([{ type: 'reasoning', summary: [] }])).toBeUndefined();
    expect(replayTurnFrom([{ type: 'reasoning', encrypted_content: '' }])).toBeUndefined();
  });

  test('a sealed reasoning item is captured with its identifier when it has one', () => {
    const withId = replayTurnFrom([signedReasoning]);
    const withoutId = replayTurnFrom([{ type: 'reasoning', encrypted_content: 'sealed-blob' }]);

    expect(withId?.reasoning).toEqual([
      {
        type: 'reasoning',
        id: 'rs_1',
        summary: [],
        content: null,
        encrypted_content: 'sealed-blob',
      },
    ]);
    expect(withoutId?.reasoning).toEqual([
      { type: 'reasoning', summary: [], content: null, encrypted_content: 'sealed-blob' },
    ]);
  });

  test('a tool call without a usable identifier is not captured', () => {
    const unnamed = replayTurnFrom([signedReasoning, { type: 'function_call', name: 'read_file' }]);
    const blank = replayTurnFrom([signedReasoning, { type: 'function_call', call_id: '' }]);

    expect(unnamed?.calls).toEqual([]);
    expect(blank?.callIds).toEqual([]);
  });

  test('a captured tool call reports its identifier', () => {
    const turn = replayTurnFrom([signedReasoning, toolCall]);

    expect(turn?.calls).toEqual([toolCall]);
    expect(turn?.callIds).toEqual(['call_1']);
  });
});

describe('Codex replay turn context', () => {
  test('the assistant answer is read from plain text content', () => {
    const turn = replayTurnFrom([signedReasoning, assistantMessage('here is the answer')]);

    expect(turn?.assistantText).toBe('here is the answer');
  });

  test('the assistant answer joins the text parts and skips the rest', () => {
    const turn = replayTurnFrom([
      signedReasoning,
      assistantMessage([{ type: 'output_text', text: 'part one ' }, { type: 'refusal' }]),
    ]);

    expect(turn?.assistantText).toBe('part one ');
  });

  test('content of an unreadable shape leaves the turn without an answer', () => {
    const turn = replayTurnFrom([signedReasoning, assistantMessage(7)]);

    expect(turn).not.toHaveProperty('assistantText');
  });

  test('an empty assistant answer leaves the turn without an answer', () => {
    const turn = replayTurnFrom([signedReasoning, assistantMessage('')]);

    expect(turn).not.toHaveProperty('assistantText');
  });

  test('a request carrying an input list fingerprints the turn', () => {
    const turn = replayTurnFrom([signedReasoning], { input: [{ type: 'message' }] });

    expect(turn?.requestFingerprint).toBe(codexReplayPrefixFingerprint([{ type: 'message' }], 1));
  });

  test('a request without an input list leaves the turn unfingerprinted', () => {
    expect(replayTurnFrom([signedReasoning], { model: 'gpt-6' })).not.toHaveProperty(
      'requestFingerprint',
    );
    expect(replayTurnFrom([signedReasoning], { input: [] })).not.toHaveProperty(
      'requestFingerprint',
    );
  });
});

describe('Codex replay prefix fingerprint', () => {
  test('a prefix outside the item list has no fingerprint', () => {
    expect(codexReplayPrefixFingerprint(['a'], -1)).toBe('');
    expect(codexReplayPrefixFingerprint(['a'], 2)).toBe('');
  });

  test('the same prefix always fingerprints the same way', () => {
    expect(codexReplayPrefixFingerprint(['a', 'b'], 1)).toBe(
      codexReplayPrefixFingerprint(['a'], 1),
    );
    expect(codexReplayPrefixFingerprint(['a', 'b'], 2)).not.toBe(
      codexReplayPrefixFingerprint(['a'], 1),
    );
  });
});

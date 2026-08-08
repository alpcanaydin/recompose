import { fc } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { insertReplayTurns } from './codex-replay-insert';
import { assistantSaying, reasoningItem, replayTurn } from './codex-replay-insert.testkit';

function replayedSignature(item: unknown): unknown {
  return typeof item === 'object' && item !== null
    ? Reflect.get(item, 'encrypted_content')
    : undefined;
}

type AnchoredHistory = { texts: string[]; picked: Set<number> };

function anchoredHistories() {
  return fc
    .uniqueArray(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 6 })
    .chain((texts) =>
      fc
        .uniqueArray(fc.integer({ min: 0, max: texts.length - 1 }), { minLength: 1 })
        .map((picks) => ({ texts, picked: new Set(picks) })),
    );
}

function turnOrderHoldsAtEveryAnchor({ texts, picked }: AnchoredHistory): void {
  const replayedTexts = texts.filter((_, index) => picked.has(index));

  const result = insertReplayTurns(
    texts.map((text) => assistantSaying(text)),
    replayedTexts.map((text) =>
      replayTurn({ assistantText: text, reasoning: [reasoningItem(`sig of ${text}`)] }),
    ),
  );

  const positions = replayedTexts.map((text) =>
    result.findIndex((item) => replayedSignature(item) === `sig of ${text}`),
  );

  expect(positions).not.toContain(-1);
  expect(positions).toStrictEqual([...positions].sort((left, right) => left - right));
}

describe('replaying several turns into one history', () => {
  test('an earlier turn never lands after a later one', () => {
    const earlier = assistantSaying('same words');
    const later = assistantSaying('later words');
    const repeated = assistantSaying('same words');

    const result = insertReplayTurns(
      [earlier, later, repeated],
      [
        replayTurn({ assistantText: 'same words', reasoning: [reasoningItem('sig-earlier')] }),
        replayTurn({ assistantText: 'later words', reasoning: [reasoningItem('sig-later')] }),
      ],
    );

    expect(result).toStrictEqual([
      reasoningItem('sig-earlier'),
      earlier,
      reasoningItem('sig-later'),
      later,
      repeated,
    ]);
  });

  test('a turn that finds no home does not shut out the turns before it', () => {
    const spoke = assistantSaying('what the client kept');

    const result = insertReplayTurns(
      [spoke],
      [
        replayTurn({
          assistantText: 'what the client kept',
          reasoning: [reasoningItem('sig-kept')],
        }),
        replayTurn({
          assistantText: 'a turn the client dropped',
          reasoning: [reasoningItem('sig-dropped')],
        }),
      ],
    );

    expect(result).toStrictEqual([reasoningItem('sig-kept'), spoke]);
  });
});

describe('replaying into generated histories', () => {
  test('chronological turn order holds at every matched anchor', () => {
    fc.assert(fc.property(anchoredHistories(), turnOrderHoldsAtEveryAnchor));
  });
});

describe('replaying a turn that has nothing left to add', () => {
  test('it leaves its anchor free for the turn before it', () => {
    const spoke = assistantSaying('hello');
    const known = reasoningItem('sig-known');

    const result = insertReplayTurns(
      [spoke, known],
      [
        replayTurn({ assistantText: 'hello', reasoning: [reasoningItem('sig-fresh')] }),
        replayTurn({ assistantText: 'hello', reasoning: [known] }),
      ],
    );

    expect(result).toStrictEqual([reasoningItem('sig-fresh'), spoke, known]);
  });
});

describe('replaying a turn whose request prefix has drifted', () => {
  test('a single unmistakable anchor still receives the replay', () => {
    const summary = { role: 'user', content: 'a compacted summary' };
    const spoke = assistantSaying('the reply');

    const result = insertReplayTurns(
      [summary, spoke],
      [
        replayTurn({
          assistantText: 'the reply',
          reasoning: [reasoningItem('sig-drifted')],
          requestFingerprint: 'a-fingerprint-no-prefix-produces',
        }),
      ],
    );

    expect(result).toStrictEqual([summary, reasoningItem('sig-drifted'), spoke]);
  });

  test('the window that keeps fallback turns in order does not hold it back', () => {
    const rules = { role: 'system', content: 'rules' };
    const ask = { role: 'user', content: 'ask' };
    const answered = { type: 'function_call_output', call_id: 'call-9', output: 'done' };

    const result = insertReplayTurns(
      [rules, ask, answered],
      [
        replayTurn({
          callIds: ['call-9'],
          reasoning: [reasoningItem('sig-fingerprinted')],
          requestFingerprint: 'a-fingerprint-no-prefix-produces',
        }),
        replayTurn({ reasoning: [reasoningItem('sig-fallback')] }),
      ],
    );

    expect(result).toStrictEqual([
      rules,
      reasoningItem('sig-fallback'),
      ask,
      reasoningItem('sig-fingerprinted'),
      answered,
    ]);
  });
});

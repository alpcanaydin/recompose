import { describe, expect, test } from 'vitest';

import { insertReplayTurns } from './codex-replay-insert';
import { assistantSaying, reasoningItem, replayTurn } from './codex-replay-insert.testkit';

const CODEX_SIGNATURE =
  'gAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('deciding whether the client already carries usable reasoning', () => {
  test('reasoning signed by another provider does not cancel the replay', () => {
    const foreign = reasoningItem('a-signature-from-elsewhere');
    const spoke = assistantSaying('hello');

    const result = insertReplayTurns(
      [foreign, spoke],
      [replayTurn({ assistantText: 'hello', reasoning: [reasoningItem('sig-fresh')] })],
    );

    expect(result).toStrictEqual([foreign, reasoningItem('sig-fresh'), spoke]);
  });

  test('a Codex signature riding on something other than reasoning does not cancel it either', () => {
    const spoke = { ...assistantSaying('hello'), encrypted_content: CODEX_SIGNATURE };

    const result = insertReplayTurns(
      [spoke],
      [replayTurn({ assistantText: 'hello', reasoning: [reasoningItem('sig-fresh')] })],
    );

    expect(result).toStrictEqual([reasoningItem('sig-fresh'), spoke]);
  });

  test('reasoning whose signature is not written as text does not cancel it either', () => {
    const unreadable = reasoningItem(7);
    const spoke = assistantSaying('hello');

    const result = insertReplayTurns(
      [unreadable, spoke],
      [replayTurn({ assistantText: 'hello', reasoning: [reasoningItem('sig-fresh')] })],
    );

    expect(result).toStrictEqual([unreadable, reasoningItem('sig-fresh'), spoke]);
  });
});

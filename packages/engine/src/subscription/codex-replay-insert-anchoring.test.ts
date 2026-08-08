import { describe, expect, test } from 'vitest';

import { insertReplayTurns } from './codex-replay-insert';
import { assistantSaying, reasoningItem, replayTurn } from './codex-replay-insert.testkit';

describe('reading what the assistant said in the history', () => {
  test('an entry that never declares itself a message is not the assistant speaking', () => {
    const spoke = assistantSaying('the answer');
    const shorthand = { role: 'assistant', content: 'no item type at all' };

    const result = insertReplayTurns(
      [spoke, shorthand],
      [replayTurn({ reasoning: [reasoningItem('sig-shorthand')] })],
    );

    expect(result).toStrictEqual([reasoningItem('sig-shorthand'), spoke, shorthand]);
  });

  test('the spoken words run together with nothing between the parts', () => {
    const spoke = assistantSaying([
      { type: 'output_text', text: 'half a ' },
      { type: 'output_text', text: 'sentence' },
    ]);

    const result = insertReplayTurns(
      [spoke],
      [replayTurn({ assistantText: 'half a sentence', reasoning: [reasoningItem('sig-parts')] })],
    );

    expect(result).toStrictEqual([reasoningItem('sig-parts'), spoke]);
  });

  test('a content part whose text is not written as text adds nothing to those words', () => {
    const spoke = assistantSaying([
      { type: 'output_text', text: 'hello' },
      { type: 'output_text', text: 7 },
    ]);

    const result = insertReplayTurns(
      [spoke],
      [replayTurn({ assistantText: 'hello', reasoning: [reasoningItem('sig-number')] })],
    );

    expect(result).toStrictEqual([reasoningItem('sig-number'), spoke]);
  });
});

describe('anchoring a turn that names neither a call nor any text', () => {
  test('it lands on the last assistant that spoke, not on the opening of the history', () => {
    const ask = { role: 'user', content: 'ask' };
    const reply = assistantSaying('reply');
    const askAgain = { role: 'user', content: 'ask again' };

    const result = insertReplayTurns(
      [ask, reply, askAgain],
      [replayTurn({ reasoning: [reasoningItem('sig-last-spoken')] })],
    );

    expect(result).toStrictEqual([ask, reasoningItem('sig-last-spoken'), reply, askAgain]);
  });
});

describe('anchoring a turn that names the calls it made', () => {
  test('a silent turn passes over the entries that carry no call of its own', () => {
    const answered = { type: 'function_call_output', call_id: 'call-1', output: 'done' };
    const asked = { type: 'message', role: 'user', content: 'and now?' };

    const result = insertReplayTurns(
      [answered, asked],
      [replayTurn({ callIds: ['call-1'], reasoning: [reasoningItem('sig-silent')] })],
    );

    expect(result).toStrictEqual([reasoningItem('sig-silent'), answered, asked]);
  });

  test('an output answering some other call is not an anchor', () => {
    const answered = { type: 'function_call_output', call_id: 'call-1', output: 'done' };
    const stranger = { type: 'function_call_output', call_id: 'call-elsewhere', output: 'noise' };

    const result = insertReplayTurns(
      [answered, stranger],
      [replayTurn({ callIds: ['call-1'], reasoning: [reasoningItem('sig-stranger')] })],
    );

    expect(result).toStrictEqual([reasoningItem('sig-stranger'), answered, stranger]);
  });

  test('a turn that made two calls anchors on the single one the client kept', () => {
    const spoke = assistantSaying('running both');
    const answered = { type: 'function_call_output', call_id: 'call-b', output: 'done' };

    const result = insertReplayTurns(
      [spoke, answered],
      [replayTurn({ callIds: ['call-a', 'call-b'], reasoning: [reasoningItem('sig-pair')] })],
    );

    expect(result).toStrictEqual([spoke, reasoningItem('sig-pair'), answered]);
  });
});

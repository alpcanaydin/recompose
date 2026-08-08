import { describe, expect, test } from 'vitest';

import { insertReplayTurns } from './codex-replay-insert';
import { assistantSaying, reasoningItem, replayTurn } from './codex-replay-insert.testkit';

describe('replaying a call the client answered but no longer carries', () => {
  test('a custom tool call returns in front of the output that answered it', () => {
    const spoke = assistantSaying('applying the patch');
    const answered = { type: 'custom_tool_call_output', call_id: 'call-1', output: 'applied' };
    const call = {
      type: 'custom_tool_call',
      call_id: 'call-1',
      name: 'apply_patch',
      input: 'a diff',
    };

    const result = insertReplayTurns(
      [spoke, answered],
      [replayTurn({ callIds: ['call-1'], calls: [call], reasoning: [reasoningItem('sig-patch')] })],
    );

    expect(result).toStrictEqual([spoke, reasoningItem('sig-patch'), call, answered]);
  });

  test('it takes the identifier of the output that answered it, not of the first output', () => {
    const stranger = { type: 'function_call_output', call_id: 'call-elsewhere', output: 'noise' };
    const answered = { type: 'function_call_output', call_id: 'call-2', output: 'file body' };
    const call = { type: 'function_call', call_id: 'call-2', name: 'Read', arguments: '{}' };

    const result = insertReplayTurns(
      [stranger, answered],
      [replayTurn({ callIds: ['call-2'], calls: [call], reasoning: [] })],
    );

    expect(result).toStrictEqual([stranger, call, answered]);
  });

  test('a call whose identifier is not written as text is left out', () => {
    const spoke = assistantSaying('running');
    const answered = { type: 'function_call_output', call_id: 7, output: 'done' };
    const call = { type: 'function_call', call_id: 7, name: 'Read', arguments: '{}' };

    const result = insertReplayTurns(
      [spoke, answered],
      [
        replayTurn({
          assistantText: 'running',
          calls: [call],
          reasoning: [reasoningItem('sig-7')],
        }),
      ],
    );

    expect(result).toStrictEqual([reasoningItem('sig-7'), spoke, answered]);
  });
});

describe('replaying against a call the client still carries', () => {
  test('a function call the client kept is not replayed a second time', () => {
    const spoke = assistantSaying('reading');
    const call = { type: 'function_call', call_id: 'call-3', name: 'Read', arguments: '{}' };
    const answered = { type: 'function_call_output', call_id: 'call-3', output: 'file body' };

    const result = insertReplayTurns(
      [spoke, call, answered],
      [replayTurn({ callIds: ['call-3'], calls: [call], reasoning: [reasoningItem('sig-3')] })],
    );

    expect(result).toStrictEqual([spoke, call, reasoningItem('sig-3'), answered]);
  });

  test('the kept function call is what the turn anchors on', () => {
    const spoke = assistantSaying('let me read');
    const call = { type: 'function_call', call_id: 'call-4', name: 'Read', arguments: '{}' };

    const result = insertReplayTurns(
      [spoke, call],
      [replayTurn({ callIds: ['call-4'], reasoning: [reasoningItem('sig-4')] })],
    );

    expect(result).toStrictEqual([spoke, reasoningItem('sig-4'), call]);
  });

  test('the kept custom tool call is what the turn anchors on', () => {
    const spoke = assistantSaying('let me patch');
    const call = {
      type: 'custom_tool_call',
      call_id: 'call-5',
      name: 'apply_patch',
      input: 'a diff',
    };

    const result = insertReplayTurns(
      [spoke, call],
      [replayTurn({ callIds: ['call-5'], reasoning: [reasoningItem('sig-5')] })],
    );

    expect(result).toStrictEqual([spoke, reasoningItem('sig-5'), call]);
  });
});

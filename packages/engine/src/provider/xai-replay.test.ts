import { expect, test } from 'vitest';

import { XAIReasoningReplay } from './xai-replay';

function encrypted(seed: number): string {
  return Buffer.alloc(256, seed).toString('base64').replace(/=+$/u, '');
}

function reasoning(seed = 1) {
  return { type: 'reasoning', summary: [], encrypted_content: encrypted(seed) };
}

const assistant = {
  type: 'message',
  role: 'assistant',
  content: [{ type: 'output_text', text: 'first answer' }],
};

test('injects xAI reasoning and assistant before a new user turn', () => {
  const replay = new XAIReasoningReplay();

  replay.commit('scope', [reasoning(), assistant]);
  const body = replay.inject('scope', {
    input: [{ type: 'message', role: 'user', content: 'second' }],
  });

  expect(body['input']).toEqual([
    reasoning(),
    assistant,
    { type: 'message', role: 'user', content: 'second' },
  ]);
});

test('skips a matching cached xAI turn already carried by input', () => {
  const replay = new XAIReasoningReplay();
  const signed = reasoning();

  replay.commit('scope', [signed, assistant]);

  expect(replay.inject('scope', { input: [signed, assistant, { role: 'user' }] })['input']).toEqual(
    [signed, assistant, { role: 'user' }],
  );
});

test('injects xAI reasoning but not a duplicate assistant message', () => {
  const replay = new XAIReasoningReplay();

  replay.commit('scope', [reasoning(), assistant]);
  const body = replay.inject('scope', {
    input: [assistant, { type: 'message', role: 'user', content: 'second' }],
  });

  expect(body['input']).toEqual([
    reasoning(),
    assistant,
    { type: 'message', role: 'user', content: 'second' },
  ]);
});

test('recognizes a role-only matching xAI assistant message', () => {
  const replay = new XAIReasoningReplay();
  const roleOnly = { role: 'assistant', content: 'first answer' };

  replay.commit('scope', [reasoning(), assistant]);

  expect(replay.inject('scope', { input: [roleOnly, { role: 'user' }] })['input']).toEqual([
    reasoning(),
    roleOnly,
    { role: 'user' },
  ]);
});

test('does not inject ambiguous xAI replay after assistant history drift', () => {
  const replay = new XAIReasoningReplay();
  const older = {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'older answer' }],
  };
  const input = [older, { type: 'message', role: 'user', content: 'next' }];

  replay.commit('scope', [reasoning(), assistant]);

  expect(replay.inject('scope', { input })['input']).toEqual(input);
});

test('replays an xAI function call immediately before its matching output', () => {
  const replay = new XAIReasoningReplay();
  const call = {
    type: 'function_call',
    call_id: 'call_1',
    name: 'lookup',
    arguments: '{"q":"weather"}',
  };

  replay.commit('scope', [call]);
  const body = replay.inject('scope', {
    input: [
      { type: 'message', role: 'user', content: 'call lookup' },
      { type: 'function_call_output', call_id: 'call_1', output: 'sunny' },
    ],
  });

  expect(body['input']).toEqual([
    { type: 'message', role: 'user', content: 'call lookup' },
    call,
    { type: 'function_call_output', call_id: 'call_1', output: 'sunny' },
  ]);
});

test('clears previous xAI replay when a completed turn has no replayable state', () => {
  const replay = new XAIReasoningReplay();

  replay.commit('scope', [reasoning(), assistant]);
  replay.commit('scope', [{ type: 'message', role: 'user', content: 'not replayable' }]);

  expect(replay.inject('scope', { input: [{ role: 'user' }] })).toEqual({
    input: [{ role: 'user' }],
  });
});

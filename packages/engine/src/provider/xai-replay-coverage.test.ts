import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { XAIReasoningReplay } from './xai-replay';

const REASONING: JsonObject = {
  type: 'reasoning',
  summary: [],
  encrypted_content: 'ZW5jcnlwdGVkLXJlYXNvbmluZw',
};

const ASSISTANT: JsonObject = {
  type: 'message',
  role: 'assistant',
  content: [{ type: 'output_text', text: 'first answer' }],
};

const LOOKUP_CALL: JsonObject = {
  type: 'function_call',
  call_id: 'call_1',
  name: 'lookup',
  arguments: '{"q":"weather"}',
};

function inputOf(body: JsonObject): unknown {
  return body['input'];
}

describe('an xAI turn the replay was never told about', () => {
  it('should hand back a body for a scope it never saw', () => {
    const replay = new XAIReasoningReplay();
    const body = { input: [{ role: 'user', content: 'hello' }] };

    expect(replay.inject('unseen', body)).toEqual(body);
  });

  it('should hand back a body that carries no input list', () => {
    const replay = new XAIReasoningReplay();

    replay.commit('scope', [REASONING, ASSISTANT]);

    expect(replay.inject('scope', { prompt: 'hello' })).toEqual({ prompt: 'hello' });
  });

  it('should hand back the turn once the scope is cleared', () => {
    const replay = new XAIReasoningReplay();
    const body = { input: [{ role: 'user', content: 'second' }] };

    replay.commit('scope', [REASONING, ASSISTANT]);
    replay.clear();

    expect(replay.inject('scope', body)).toEqual(body);
  });
});

describe('what the xAI replay agrees to remember', () => {
  it.each([
    { name: 'an answer that is not a list', output: { output: 'text' } },
    { name: 'a list holding nothing replayable', output: [{ type: 'function_call_output' }] },
    { name: 'an empty list', output: [] },
  ])('should forget an earlier turn after $name', ({ output }) => {
    const replay = new XAIReasoningReplay();
    const body = { input: [{ role: 'user', content: 'second' }] };

    replay.commit('scope', [REASONING, ASSISTANT]);
    replay.commit('scope', output);

    expect(replay.inject('scope', body)).toEqual(body);
  });

  it('should forget the oldest scope once the ceiling is passed', () => {
    const replay = new XAIReasoningReplay();
    const body = { input: [{ role: 'user', content: 'second' }] };

    for (let scope = 0; scope <= 4_096; scope += 1) {
      replay.commit(`scope-${String(scope)}`, [REASONING]);
    }

    expect(replay.inject('scope-0', body)).toEqual(body);
    expect(inputOf(replay.inject('scope-4096', body))).toHaveLength(2);
  });
});

describe('an xAI assistant turn the replay cannot line up', () => {
  it.each([
    { name: 'a number', content: 42 },
    { name: 'a list of bare values', content: [1, 2] },
  ])('should leave the turn alone when the assistant content is %s', ({ content }) => {
    const replay = new XAIReasoningReplay();
    const input = [
      { role: 'assistant', content },
      { role: 'user', content: 'next' },
    ];

    replay.commit('scope', [REASONING, ASSISTANT]);

    expect(inputOf(replay.inject('scope', { input }))).toEqual(input);
  });
});

describe('the xAI tool calls the replay puts back', () => {
  it('should leave a cached call with a blank id out of the turn', () => {
    const replay = new XAIReasoningReplay();
    const input = [{ type: 'function_call_output', call_id: 'call_1', output: 'sunny' }];

    replay.commit('scope', [{ ...LOOKUP_CALL, call_id: '   ' }]);

    expect(inputOf(replay.inject('scope', { input }))).toEqual(input);
  });

  it('should leave a tool output whose id is not spelled as text alone', () => {
    const replay = new XAIReasoningReplay();
    const input = [{ type: 'function_call_output', call_id: 7, output: 'sunny' }];

    replay.commit('scope', [LOOKUP_CALL]);

    expect(inputOf(replay.inject('scope', { input }))).toEqual(input);
  });

  it('should replay every cached call that answers the same tool output', () => {
    const replay = new XAIReasoningReplay();
    const retry = { ...LOOKUP_CALL, arguments: '{"q":"weather again"}' };
    const output = { type: 'function_call_output', call_id: 'call_1', output: 'sunny' };

    replay.commit('scope', [LOOKUP_CALL, retry]);

    expect(inputOf(replay.inject('scope', { input: [output] }))).toEqual([
      LOOKUP_CALL,
      retry,
      output,
    ]);
  });

  it('should shift the reasoning past a call it replayed ahead of the assistant', () => {
    const replay = new XAIReasoningReplay();
    const output = { type: 'function_call_output', call_id: 'call_1', output: 'sunny' };
    const user = { type: 'message', role: 'user', content: 'and now' };

    replay.commit('scope', [REASONING, ASSISTANT, LOOKUP_CALL]);

    expect(inputOf(replay.inject('scope', { input: [output, ASSISTANT, user] }))).toEqual([
      LOOKUP_CALL,
      output,
      REASONING,
      ASSISTANT,
      user,
    ]);
  });
});

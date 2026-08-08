import { describe, expect, test } from 'vitest';

import { XAIWebSocketTranscript, validateXAICompactionResponse } from './xai-websocket-transcript';

function encrypted(seed = 5): string {
  return Buffer.from(
    Array.from({ length: 256 }, (_value, index) => (index * 41 + seed * 67 + 17) % 251),
  )
    .toString('base64')
    .replace(/=+$/u, '');
}

const compaction = { type: 'compaction', encrypted_content: encrypted() };
const user = { type: 'message', role: 'user', content: 'hello' };
const assistant = { type: 'message', role: 'assistant', content: 'answer' };

describe('validateXAICompactionResponse', () => {
  test('accepts a response carrying native compacted state', () => {
    expect(validateXAICompactionResponse({ id: 'resp_compact', output: [compaction] })).toEqual({
      responseId: 'resp_compact',
      item: compaction,
    });
  });

  test.each([
    null,
    {},
    { id: 'resp_compact', output: [] },
    { id: 'resp_compact', output: [{ type: 'compaction', encrypted_content: 'invalid' }] },
  ])('rejects invalid compact responses %j', (value) => {
    expect(validateXAICompactionResponse(value)).toBeNull();
  });
});

test('records xAI request input and completed output in order', () => {
  const transcript = new XAIWebSocketTranscript();

  transcript.record({ input: [user] }, { response: { output: [assistant] } }, false);

  expect(transcript.snapshot()).toEqual([user, assistant]);
});

test('replays xAI compacted transcript on a full append without previous_response_id', () => {
  const transcript = new XAIWebSocketTranscript();

  transcript.replaceWithCompaction(compaction);
  const prepared = transcript.prepare({
    type: 'response.append',
    input: [{ type: 'message', role: 'user', content: 'after compact' }],
  });

  expect(prepared.replayed).toBe(true);
  expect(prepared.body['input']).toEqual([
    compaction,
    { type: 'message', role: 'user', content: 'after compact' },
  ]);
});

test('maps an xAI compact response ID to replay without upstream previous state', () => {
  const transcript = new XAIWebSocketTranscript();

  transcript.replaceWithCompaction(compaction, 'resp_compact');
  const prepared = transcript.prepare({
    previous_response_id: 'resp_compact',
    input: [{ type: 'message', role: 'user', content: 'next' }],
  });

  expect(prepared.replayed).toBe(true);
  expect(prepared.body['previous_response_id']).toBeUndefined();
  expect(prepared.body['input']).toEqual([
    compaction,
    { type: 'message', role: 'user', content: 'next' },
  ]);
});

test('keeps xAI compaction context after a generate-false warmup turn', () => {
  const transcript = new XAIWebSocketTranscript();
  const warmup = {
    generate: false,
    input: [{ type: 'message', role: 'user', content: 'warm up' }],
  };

  transcript.replaceWithCompaction(compaction);
  const prepared = transcript.prepare(warmup);

  transcript.record(prepared.body, { response: { output: [] } }, prepared.replayed);

  expect(transcript.compactionPayload({ model: 'grok-4.3' })['input']).toEqual([
    compaction,
    { type: 'message', role: 'user', content: 'warm up' },
  ]);
});

test('an empty xAI full reset clears pending compacted replay', () => {
  const transcript = new XAIWebSocketTranscript();

  transcript.replaceWithCompaction(compaction);
  expect(transcript.prepare({ input: [] }).replayed).toBe(false);
  expect(transcript.snapshot()).toEqual([]);
});

describe('the shapes a recorded xAI turn arrives in', () => {
  test('a completed turn naming its output at the top level still records', () => {
    const transcript = new XAIWebSocketTranscript();

    transcript.record({ input: [user] }, { output: [assistant] }, false);

    expect(transcript.snapshot()).toEqual([user, assistant]);
  });

  test('an input that is not a list contributes nothing but the output still records', () => {
    const transcript = new XAIWebSocketTranscript();

    transcript.record({ input: 'not a list' }, { response: { output: [assistant] } }, false);

    expect(transcript.snapshot()).toEqual([assistant]);
  });

  test('a turn carrying neither input nor output leaves the transcript as it stands', () => {
    const transcript = new XAIWebSocketTranscript();

    transcript.record({ input: [user] }, { response: { output: [assistant] } }, false);
    transcript.record({}, {}, false);

    expect(transcript.snapshot()).toEqual([user, assistant]);
  });
});

describe('the compaction item an xAI transcript accepts in place of its history', () => {
  test.each([
    ['a plain message', user],
    [
      'a compaction whose encrypted content is too short to be real',
      { type: 'compaction', encrypted_content: 'nope' },
    ],
  ])('%s is refused and the standing transcript survives', (_name, item) => {
    const transcript = new XAIWebSocketTranscript();

    transcript.record({ input: [user] }, { response: { output: [assistant] } }, false);

    expect(transcript.replaceWithCompaction(item)).toBe(false);
    expect(transcript.snapshot()).toEqual([user, assistant]);
  });
});

describe('the turns an xAI transcript declines to replay into', () => {
  test('a turn resuming an upstream response the compaction never covered is left alone', () => {
    const transcript = new XAIWebSocketTranscript();
    const body = { previous_response_id: 'resp_upstream', input: [user] };

    transcript.replaceWithCompaction(compaction, 'resp_compact');
    const prepared = transcript.prepare(body);

    expect(prepared.replayed).toBe(false);
    expect(prepared.body).toBe(body);
  });

  test('a turn on a transcript with nothing pending is left alone', () => {
    const transcript = new XAIWebSocketTranscript();

    transcript.record({ input: [user] }, { response: { output: [assistant] } }, false);
    const prepared = transcript.prepare({ input: [user] });

    expect(prepared.replayed).toBe(false);
    expect(prepared.body['input']).toEqual([user]);
  });
});

import { describe, expect, test } from 'vitest';

import { XAIWebSocketTranscript, validateXAICompactionResponse } from './xai-websocket-transcript';

function encrypted(seed = 5): string {
  return Buffer.alloc(256, seed).toString('base64').replace(/=+$/u, '');
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

describe('XAIWebSocketTranscript', () => {
  test('records request input and completed output in order', () => {
    const transcript = new XAIWebSocketTranscript();

    transcript.record({ input: [user] }, { response: { output: [assistant] } }, false);

    expect(transcript.snapshot()).toEqual([user, assistant]);
  });

  test('replays compacted transcript on the next full append without previous_response_id', () => {
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

  test('keeps replayed compaction context after a generate-false warmup turn', () => {
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

  test('an empty full reset clears pending compacted replay', () => {
    const transcript = new XAIWebSocketTranscript();

    transcript.replaceWithCompaction(compaction);
    expect(transcript.prepare({ input: [] }).replayed).toBe(false);
    expect(transcript.snapshot()).toEqual([]);
  });
});

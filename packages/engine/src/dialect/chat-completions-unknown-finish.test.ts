import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';

import { decodeResponse, decodeStream } from './chat-completions-codec';
import { aChatResponse, collect, streamOf } from './chat-completions.testkit';

describe('the codec survives a finish reason outside the documented set', () => {
  it('decodes an unfamiliar finish reason as a clean end rather than throwing', () => {
    const response = aChatResponse({
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'function_call',
        },
      ],
    });

    expect(decodeResponse(response).value.stopReason).toBe('end');
  });

  it('ends a stream whose final chunk carries an unfamiliar finish reason cleanly', async () => {
    const frames: readonly ChatStreamFrame[] = [
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: { content: 'hi' } }] } },
      { type: 'chunk', chunk: { choices: [{ index: 0, delta: {}, finish_reason: 'eos' }] } },
      { type: 'done' },
    ];

    const events = await collect(decodeStream(streamOf(frames)));

    expect(events.at(-1)).toMatchObject({ type: 'message-end', stopReason: 'end' });
  });
});

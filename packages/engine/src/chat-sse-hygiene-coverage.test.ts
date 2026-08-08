import { describe, expect, it } from 'vitest';

import { chatSseUntilDone } from './chat-sse-hygiene';

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));

      controller.close();
    },
  });
}

describe('deciding whether a chat answer speaks server-sent events', () => {
  it('should hold its verdict while the opening bytes still could say data:', async () => {
    const answer = await new Response(
      chatSseUntilDone(streamOf(['da', 'ta: {"choices":[]}\n\n', 'data: [DONE]\n\n'])),
    ).text();

    expect(answer).toBe('data: {"choices":[]}\n\ndata: [DONE]\n\n');
  });
});

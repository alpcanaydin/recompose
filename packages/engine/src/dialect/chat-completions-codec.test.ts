import { describe, expect, it } from 'vitest';

import {
  decodeRequest,
  decodeResponse,
  decodeStream,
  encodeRequest,
  encodeResponse,
  encodeStream,
} from './chat-completions-codec';
import {
  aChatRequest,
  aChatResponse,
  aChatToolCallChunkStream,
  collect,
  streamOf,
} from './chat-completions.testkit';
import { aHubRequest, aHubResponse, aHubStreamOfAToolCall } from './hub.testkit';

describe('the Chat Completions codec barrel wires each leg for the dispatcher', () => {
  it('exposes the request legs through the barrel', () => {
    const decoded = decodeRequest(aChatRequest());

    expect('refusal' in decoded).toBe(false);
    expect(encodeRequest(aHubRequest()).value.messages.length).toBeGreaterThan(0);
  });

  it('exposes the response legs through the barrel', () => {
    expect(decodeResponse(aChatResponse()).value.stopReason).toBe('end');
    expect('value' in encodeResponse(aHubResponse())).toBe(true);
  });

  it('exposes the stream legs through the barrel', async () => {
    const events = await collect(decodeStream(streamOf(aChatToolCallChunkStream())));
    const frames = await collect(encodeStream(streamOf(aHubStreamOfAToolCall())));

    expect(events.at(-1)?.type).toBe('message-end');
    expect(frames.at(-1)).toEqual({ type: 'done' });
  });
});

import { describe, expect, it } from 'vitest';

import {
  aChatRequest,
  aChatToolCallChunkStream,
  collect,
  streamOf,
} from './chat-completions.testkit';
import { translateRequest, translateResponse, translateStream } from './dispatcher';
import { aHubResponse, aHubStreamOfAToolCall, aHubThinkingBlock } from './hub.testkit';
import {
  aCodexRequestWithTools,
  aResponsesRequest,
  aResponsesToolCallStream,
} from './responses.testkit';

describe('a same-dialect crossing skips translation and reports passthrough', () => {
  it('reports passthrough when a request crosses to its own dialect', () => {
    const result = translateRequest('chat-completions', 'chat-completions', aChatRequest());

    expect(result).toEqual({ outcome: 'passthrough' });
  });

  it('reports passthrough when a response crosses to its own dialect', () => {
    const result = translateResponse('anthropic', 'anthropic', aHubResponse());

    expect(result).toEqual({ outcome: 'passthrough' });
  });

  it('reports passthrough when a stream crosses to its own dialect', () => {
    const result = translateStream('responses', 'responses', streamOf(aResponsesToolCallStream()));

    expect(result).toEqual({ outcome: 'passthrough' });
  });
});

describe('the dispatcher composes a decoder with an encoder through the hub', () => {
  it('carries a decoded Codex request out as an Anthropic body with the decode leg fates', () => {
    const result = translateRequest('responses', 'anthropic', aCodexRequestWithTools());

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.value.messages.length).toBeGreaterThan(0);
    expect(result.fates.length).toBeGreaterThan(0);
  });

  it('carries the encode leg fate when the hub drops a thinking block toward the target', () => {
    const source = { messages: [{ role: 'assistant' as const, content: [aHubThinkingBlock()] }] };
    const result = translateRequest('anthropic', 'chat-completions', source);

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.fates.some((fate) => fate.field === 'thinking')).toBe(true);
  });

  it('records an empty ledger when a plain request crosses with nothing to note', () => {
    const source = {
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] }],
    };
    const result = translateRequest('anthropic', 'chat-completions', source);

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.fates).toEqual([]);
  });

  it('records an empty ledger when a plain response crosses with nothing to note', () => {
    const result = translateResponse('anthropic', 'chat-completions', aHubResponse());

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.fates).toEqual([]);
  });
});

describe('the dispatcher composes the stream legs through the hub', () => {
  it('decodes a Chat Completions stream toward the Anthropic hub events', async () => {
    const result = translateStream(
      'chat-completions',
      'anthropic',
      streamOf(aChatToolCallChunkStream()),
    );

    if ('outcome' in result) {
      throw new Error('expected a translated stream, not a passthrough');
    }

    const events = await collect(result.stream);

    expect(events.at(-1)?.type).toBe('message-end');
  });

  it('encodes the Anthropic hub stream toward the Chat Completions frames', async () => {
    const result = translateStream(
      'anthropic',
      'chat-completions',
      streamOf(aHubStreamOfAToolCall()),
    );

    if ('outcome' in result) {
      throw new Error('expected a translated stream, not a passthrough');
    }

    const frames = await collect(result.stream);

    expect(frames.at(-1)).toEqual({ type: 'done' });
  });
});

describe('a refusing leg surfaces the refusal to the caller', () => {
  it('surfaces the decode refusal when the source carries a server-state field', () => {
    const result = translateRequest(
      'responses',
      'chat-completions',
      aResponsesRequest({ previous_response_id: 'resp_prev' }),
    );

    expect(result).toEqual({
      refusal: { reason: 'unsupported-field', field: 'previous_response_id' },
    });
  });

  it('surfaces the encode refusal when the hub stop reason has no target counterpart', () => {
    const result = translateResponse(
      'anthropic',
      'chat-completions',
      aHubResponse({ stopReason: 'paused' }),
    );

    expect(result).toEqual({ refusal: { reason: 'unmappable-stop-reason', stopReason: 'paused' } });
  });
});

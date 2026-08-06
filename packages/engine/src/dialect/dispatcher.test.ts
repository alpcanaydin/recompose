import { describe, expect, it } from 'vitest';

import { anAnthropicAnswer, anAnthropicAsk, anAnthropicWireTextStream } from './anthropic.testkit';
import {
  aChatRequest,
  aChatToolCallChunkStream,
  collect,
  streamOf,
} from './chat-completions.testkit';
import { translateRequest, translateResponse, translateStream } from './dispatcher';
import { aCodexRequestWithTools, aResponsesRequest } from './responses.testkit';

describe('a same-dialect crossing skips translation and reports passthrough', () => {
  it('reports passthrough when a request crosses to its own dialect', () => {
    const result = translateRequest('chat-completions', 'chat-completions', aChatRequest());

    expect(result).toEqual({ outcome: 'passthrough' });
  });

  it('reports passthrough when a response crosses to its own dialect', () => {
    const result = translateResponse('anthropic', 'anthropic', anAnthropicAnswer());

    expect(result).toEqual({ outcome: 'passthrough' });
  });

  it('reports passthrough when a stream crosses to its own dialect', () => {
    const result = translateStream('anthropic', 'anthropic', streamOf(anAnthropicWireTextStream()));

    expect(result).toEqual({ outcome: 'passthrough' });
  });
});

describe('the dispatcher composes a decoder with an encoder through the hub', () => {
  it('carries a decoded Codex request out as an Anthropic wire body with the decode leg fates', () => {
    const result = translateRequest('responses', 'anthropic', aCodexRequestWithTools());

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.value.messages.length).toBeGreaterThan(0);
    expect(result.value.max_tokens).toBeGreaterThan(0);
    expect(result.fates.length).toBeGreaterThan(0);
  });

  it('carries the encode leg fate when the hub drops a thinking block toward the target', () => {
    const result = translateRequest(
      'anthropic',
      'chat-completions',
      anAnthropicAsk({
        messages: [
          { role: 'assistant', content: [{ type: 'thinking', thinking: 'weigh the routes' }] },
        ],
      }),
    );

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.fates.some((fate) => fate.field === 'thinking')).toBe(true);
  });

  it('records only the envelope crossing fates for a plain wire request', () => {
    const result = translateRequest('anthropic', 'chat-completions', {
      max_tokens: 1024,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.fates).toEqual([
      { field: 'messages', disposition: 'mapped', to: 'messages' },
      { field: 'max_tokens', disposition: 'mapped', to: 'sampling.maxOutputTokens' },
      { field: 'sampling', disposition: 'mapped', to: 'sampling' },
    ]);
  });

  it('records an empty ledger when a plain response crosses with nothing to note', () => {
    const result = translateResponse('anthropic', 'chat-completions', anAnthropicAnswer());

    if ('outcome' in result || 'refusal' in result) {
      throw new Error('expected a translated body, not a passthrough or refusal');
    }

    expect(result.fates).toEqual([]);
  });
});

describe('the dispatcher composes the stream legs through the hub', () => {
  it('decodes a Chat Completions stream out to the named Anthropic wire events', async () => {
    const result = translateStream(
      'chat-completions',
      'anthropic',
      streamOf(aChatToolCallChunkStream()),
    );

    if ('outcome' in result) {
      throw new Error('expected a translated stream, not a passthrough');
    }

    const events = await collect(result.stream);

    expect(events.at(0)?.type).toBe('message_start');
    expect(events.at(-1)?.type).toBe('message_stop');
  });

  it('encodes an Anthropic wire stream toward the Chat Completions frames', async () => {
    const result = translateStream(
      'anthropic',
      'chat-completions',
      streamOf(anAnthropicWireTextStream()),
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
      anAnthropicAnswer({ stop_reason: 'pause_turn' }),
    );

    expect(result).toEqual({ refusal: { reason: 'unmappable-stop-reason', stopReason: 'paused' } });
  });
});

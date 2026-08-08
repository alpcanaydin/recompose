import { describe, expect, test } from 'vitest';

import type { HubResponse } from './hub';
import type { InteractionsResponse } from './interactions-wire';

import { decodeResponse, encodeResponse, hubUsageFromInteractions } from './interactions-response';

function interaction(fields: Partial<InteractionsResponse>): InteractionsResponse {
  return { id: 'interaction_1', steps: [], ...fields };
}

function answer(fields: Partial<HubResponse>): HubResponse {
  return { content: [], stopReason: 'end', usage: {}, ...fields };
}

describe('interactions answer decoding', () => {
  test('a thought without a signature decodes to plain thinking', () => {
    const decoded = decodeResponse(
      interaction({ steps: [{ type: 'thought', content: 'weighing options' }] }),
    );

    expect(decoded.value.content).toEqual([{ type: 'thinking', text: 'weighing options' }]);
  });

  test('a tool call without an identifier borrows its tool name', () => {
    const decoded = decodeResponse(
      interaction({ steps: [{ type: 'function_call', name: 'lookup', arguments: { q: 'gold' } }] }),
    );

    expect(decoded.value.content).toEqual([
      { type: 'tool_use', id: 'lookup', name: 'lookup', input: { q: 'gold' } },
    ]);
    expect(decoded.value.stopReason).toBe('tool_use');
  });

  test('a tool call keeps the signature it arrived with', () => {
    const decoded = decodeResponse(
      interaction({
        steps: [
          {
            type: 'function_call',
            id: 'fc_1',
            name: 'lookup',
            arguments: '{"q":1}',
            signature: 's',
          },
        ],
      }),
    );

    expect(decoded.value.content).toEqual([
      { type: 'tool_use', id: 'fc_1', name: 'lookup', input: { q: 1 }, signature: 's' },
    ]);
  });
});

describe('interactions completion decoding', () => {
  test('steps that hold no model output are dropped', () => {
    const decoded = decodeResponse(
      interaction({
        steps: [
          { type: 'user_input', content: 'question' },
          { type: 'function_result', call_id: 'fc_1', result: 'ok' },
        ],
      }),
    );

    expect(decoded.value.content).toEqual([]);
  });

  test('an incomplete interaction stopped at the output ceiling', () => {
    expect(decodeResponse(interaction({ status: 'incomplete' })).value.stopReason).toBe(
      'max_output',
    );
  });

  test('a failed interaction was refused', () => {
    expect(decodeResponse(interaction({ status: 'failed' })).value.stopReason).toBe('refusal');
  });
});

describe('interactions usage decoding', () => {
  test('an interaction without usage reports nothing', () => {
    expect(hubUsageFromInteractions(undefined)).toEqual({});
  });

  test('prompt and completion counts stand in for the totals', () => {
    expect(hubUsageFromInteractions({ prompt_tokens: 10, completion_tokens: 4 })).toEqual({
      inputTokens: 10,
      outputTokens: 4,
    });
  });

  test('cached tokens alone leave the input count unknown', () => {
    expect(hubUsageFromInteractions({ cached_tokens: 3 })).toEqual({ cacheReadTokens: 3 });
  });

  test('cached tokens are taken out of the reported input total', () => {
    expect(hubUsageFromInteractions({ total_input_tokens: 10, total_cached_tokens: 4 })).toEqual({
      inputTokens: 6,
      cacheReadTokens: 4,
    });
  });
});

describe('interactions answer encoding', () => {
  test('an answer without an identifier is given a translated one', () => {
    const encoded = encodeResponse(answer({ content: [{ type: 'thinking', text: 'weighing' }] }));

    expect(encoded.value.id).toBe('interaction_translated');
    expect(encoded.value.status).toBe('completed');
    expect(encoded.value.steps).toEqual([
      { type: 'thought', content: [{ type: 'text', text: 'weighing' }] },
    ]);
  });

  test('a signed thought carries its signature across', () => {
    const encoded = encodeResponse(
      answer({ id: 'i_1', content: [{ type: 'thinking', text: 'weighing', signature: 'sig' }] }),
    );

    expect(encoded.value.steps).toEqual([
      { type: 'thought', content: [{ type: 'text', text: 'weighing' }], signature: 'sig' },
    ]);
  });

  test('media the dialect cannot carry is dropped from the answer', () => {
    const encoded = encodeResponse(
      answer({ content: [{ type: 'audio', source: { type: 'url', url: 'https://a/b.mp3' } }] }),
    );

    expect(encoded.value.steps).toEqual([]);
  });

  test('a refused answer reports a failed interaction', () => {
    expect(encodeResponse(answer({ stopReason: 'refusal' })).value.status).toBe('failed');
  });

  test('an answer stopped at the ceiling reports an incomplete interaction', () => {
    expect(encodeResponse(answer({ stopReason: 'max_output' })).value.status).toBe('incomplete');
    expect(encodeResponse(answer({ stopReason: 'context_overflow' })).value.status).toBe(
      'incomplete',
    );
  });

  test('an answer awaiting a tool reports an interaction that requires action', () => {
    expect(encodeResponse(answer({ stopReason: 'tool_use' })).value.status).toBe('requires_action');
  });
});

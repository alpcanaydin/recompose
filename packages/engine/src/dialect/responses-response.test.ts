import { describe, expect, it } from 'vitest';

import type { HubThinkingBlock, HubToolUseBlock } from './hub';

import {
  aHubImageBlock,
  aHubResponse,
  aHubTextBlock,
  aHubThinkingBlock,
  aHubToolUseBlock,
} from './hub.testkit';
import { decodeResponse, encodeResponse } from './responses-codec';
import {
  aCompatibleReasoningItem,
  aResponsesResponse,
  aResponsesToolCallResponse,
  expectRefusal,
  expectTranslation,
  fateFor,
} from './responses.testkit';

describe('decodeResponse: an answer folds into the hub', () => {
  it('carries a tool call, its stop reason, and its usage into the hub shape', () => {
    const { value } = expectTranslation(decodeResponse(aResponsesToolCallResponse()));

    const toolUse = value.content.find(
      (block): block is HubToolUseBlock => block.type === 'tool_use',
    );

    expect(toolUse).toEqual({
      type: 'tool_use',
      id: 'call_weather',
      name: 'get_weather',
      input: { city: 'Paris' },
    });
    expect(value.stopReason).toBe('tool_use');
    expect(value.usage).toEqual({ inputTokens: 20, outputTokens: 5 });
  });

  it('carries a plain text answer with an end stop reason', () => {
    const { value } = expectTranslation(decodeResponse(aResponsesResponse()));

    expect(value.content[0]).toEqual({ type: 'text', text: 'Sunny.' });
    expect(value.stopReason).toBe('end');
  });

  it('reads cached and reasoning token details into the hub usage, cache reads excluded from input', () => {
    const response = aResponsesResponse({
      usage: {
        input_tokens: 30,
        output_tokens: 10,
        input_tokens_details: { cached_tokens: 6 },
        output_tokens_details: { reasoning_tokens: 4 },
      },
    });

    const { value } = expectTranslation(decodeResponse(response));

    expect(value.usage).toEqual({
      inputTokens: 24,
      outputTokens: 10,
      cacheReadTokens: 6,
      reasoningTokens: 4,
    });
  });

  it('clamps input tokens to zero when a provider reports more cache reads than input', () => {
    const response = aResponsesResponse({
      usage: { input_tokens: 3, output_tokens: 1, input_tokens_details: { cached_tokens: 5 } },
    });

    expect(expectTranslation(decodeResponse(response)).value.usage).toEqual({
      inputTokens: 0,
      outputTokens: 1,
      cacheReadTokens: 5,
    });
  });
});

describe('decodeResponse: a reasoning output crosses as a thinking block', () => {
  it('reads a reasoning output item as a thinking block with no fabricated signature', () => {
    const response = aResponsesResponse({
      output: [
        { type: 'reasoning', id: 'rs_1', summary: [{ type: 'summary_text', text: 'ponder' }] },
      ],
    });

    const { value } = expectTranslation(decodeResponse(response));

    const thinking = value.content.find(
      (block): block is HubThinkingBlock => block.type === 'thinking',
    );

    expect(thinking?.text).toBe('ponder');
    expect(thinking?.signature).toBeUndefined();
  });
});

describe('decodeResponse: the stop reason maps or refuses', () => {
  it('maps an incomplete max-output answer to the hub max-output stop', () => {
    const response = aResponsesResponse({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
    });

    expect(expectTranslation(decodeResponse(response)).value.stopReason).toBe('max_output');
  });

  it('maps an incomplete content-filter answer to the hub refusal stop', () => {
    const response = aResponsesResponse({
      status: 'incomplete',
      incomplete_details: { reason: 'content_filter' },
    });

    expect(expectTranslation(decodeResponse(response)).value.stopReason).toBe('refusal');
  });

  it('refuses typed when the incomplete reason has no hub counterpart', () => {
    const response = aResponsesResponse({
      status: 'incomplete',
      incomplete_details: { reason: 'server_pause' },
    });

    expect(expectRefusal(decodeResponse(response))).toEqual({
      reason: 'unmappable-stop-reason',
      stopReason: 'server_pause',
    });
  });

  it('refuses typed when the answer failed', () => {
    expect(expectRefusal(decodeResponse(aResponsesResponse({ status: 'failed' })))).toEqual({
      reason: 'unmappable-stop-reason',
      stopReason: 'failed',
    });
  });

  it('refuses typed when an incomplete answer names no reason', () => {
    expect(expectRefusal(decodeResponse(aResponsesResponse({ status: 'incomplete' })))).toEqual({
      reason: 'unmappable-stop-reason',
      stopReason: 'incomplete',
    });
  });
});

describe('encodeResponse: a hub answer folds back out to Responses', () => {
  it('renders a text answer as a completed response with an output message', () => {
    const { value } = expectTranslation(encodeResponse(aHubResponse()));

    expect(value.status).toBe('completed');
    expect(value.output[0]).toEqual({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'hello from the hub' }],
    });
  });

  it('renders a tool_use answer as a function_call output item', () => {
    const response = aHubResponse({ content: [aHubToolUseBlock()], stopReason: 'tool_use' });

    const { value } = expectTranslation(encodeResponse(response));

    expect(value.status).toBe('completed');
    expect(value.output[0]).toEqual({
      type: 'function_call',
      call_id: 'toolu_weather',
      name: 'get_weather',
      arguments: '{"city":"Paris"}',
    });
  });

  it('carries hub usage, cache reads, and reasoning into the Responses usage counts', () => {
    const response = aHubResponse({
      usage: { inputTokens: 7, outputTokens: 3, reasoningTokens: 2, cacheReadTokens: 5 },
    });

    const { value } = expectTranslation(encodeResponse(response));

    expect(value.usage).toEqual({
      input_tokens: 12,
      output_tokens: 3,
      input_tokens_details: { cached_tokens: 5 },
      output_tokens_details: { reasoning_tokens: 2 },
    });
  });

  it('drops an unexpected image block from the answer with a named fate', () => {
    const response = aHubResponse({ content: [aHubImageBlock(), aHubTextBlock({ text: 'ok' })] });

    const { value, fates } = expectTranslation(encodeResponse(response));

    expect(value.output).toEqual([
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] },
    ]);
    expect(fateFor(fates, 'image')).toEqual({
      field: 'image',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});

describe('encodeResponse: the stop reason maps or refuses', () => {
  it('renders a max-output stop as an incomplete max-output-tokens response', () => {
    const { value } = expectTranslation(
      encodeResponse(aHubResponse({ content: [aHubTextBlock()], stopReason: 'max_output' })),
    );

    expect(value.status).toBe('incomplete');
    expect(value.incomplete_details).toEqual({ reason: 'max_output_tokens' });
  });

  it('renders a refusal stop as an incomplete content-filter response and records the loss', () => {
    const { value, fates } = expectTranslation(
      encodeResponse(aHubResponse({ content: [aHubTextBlock()], stopReason: 'refusal' })),
    );

    expect(value.incomplete_details).toEqual({ reason: 'content_filter' });
    expect(fateFor(fates, 'stopReason')).toEqual({
      field: 'stopReason',
      disposition: 'mapped',
      to: 'incomplete.content_filter',
    });
  });

  it('drops a thinking block toward Responses with a cost-bearing fate', () => {
    const response = aHubResponse({
      content: [aHubThinkingBlock(), aHubTextBlock({ text: 'ok' })],
    });

    const { value, fates } = expectTranslation(encodeResponse(response));

    const reasoning = value.output.flatMap((item) => (item.type === 'reasoning' ? [item] : []));

    expect(reasoning).toHaveLength(0);
    expect(fateFor(fates, 'thinking')).toEqual({
      field: 'thinking',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });

  it('refuses typed when a paused stop has no Responses counterpart', () => {
    expect(expectRefusal(encodeResponse(aHubResponse({ stopReason: 'paused' })))).toEqual({
      reason: 'unmappable-stop-reason',
      stopReason: 'paused',
    });
  });

  it('refuses typed when a context-overflow stop has no Responses counterpart', () => {
    expect(expectRefusal(encodeResponse(aHubResponse({ stopReason: 'context_overflow' })))).toEqual(
      {
        reason: 'unmappable-stop-reason',
        stopReason: 'context_overflow',
      },
    );
  });
});

describe('decodeResponse maps a reasoning output item by its signature', () => {
  it('carries a compatible reasoning signature into the hub thinking block, naming the fate', () => {
    const response = aResponsesResponse({ output: [aCompatibleReasoningItem('sig-r')] });

    const { value, fates } = expectTranslation(decodeResponse(response));
    const thinking = value.content.find(
      (block): block is HubThinkingBlock => block.type === 'thinking',
    );

    expect(thinking?.signature).toBe('sig-r');
    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'thinking.signature',
    });
  });

  it('keeps a signature-only Codex reasoning item for the next turn', () => {
    const signature =
      'gAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const response = aResponsesResponse({
      output: [{ type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: signature }],
    });

    const { value } = expectTranslation(decodeResponse(response));

    expect(value.content).toContainEqual({ type: 'thinking', text: '', signature });
  });
});

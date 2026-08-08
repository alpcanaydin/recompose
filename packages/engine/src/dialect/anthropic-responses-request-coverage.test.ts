import { describe, expect, test } from 'vitest';

import type { TranslationRefusal } from '../refusals';
import type { TranslateResult } from './fates';
import type { HubContentBlock, HubRequest, HubToolResultBlock } from './hub';

import { anthropicRequestForResponses } from './anthropic-responses-request';

function translated(value: HubRequest): TranslateResult<HubRequest, TranslationRefusal> {
  return { value, fates: [] };
}

function requestOf(...content: readonly HubContentBlock[]): HubRequest {
  return { messages: [{ role: 'user', content }] };
}

function translatedRequest(decoded: TranslateResult<HubRequest, TranslationRefusal>): HubRequest {
  if ('refusal' in decoded) throw new Error('expected a translation, met a refusal');

  return decoded.value;
}

function firstToolResult(value: HubRequest): HubToolResultBlock | undefined {
  return value.messages
    .at(0)
    ?.content.find((block): block is HubToolResultBlock => block.type === 'tool_result');
}

function toolResultHolding(...content: HubToolResultBlock['content']): HubToolResultBlock {
  return { type: 'tool_result', toolUseId: 'call_1', content };
}

describe('an Anthropic turn reshaped for a Responses target', () => {
  test('a refusal upstream travels on untouched', () => {
    const refused: TranslateResult<HubRequest, TranslationRefusal> = {
      refusal: { reason: 'unsupported-field', field: 'thinking' },
    };

    expect(anthropicRequestForResponses(refused, 'claude-opus-5')).toBe(refused);
  });

  test('the source model defaults to anthropic when the caller names none', () => {
    const value = translatedRequest(
      anthropicRequestForResponses(translated(requestOf({ type: 'text', text: 'hi' })), undefined),
    );

    expect(value.sourceModel).toBe('anthropic');
    expect(value.parallelToolCalls).toBe(true);
  });

  test('a caller that names a source model and a parallel setting keeps both', () => {
    const decoded = translated({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      parallelToolCalls: false,
    });
    const value = translatedRequest(anthropicRequestForResponses(decoded, 'claude-opus-5'));

    expect(value.sourceModel).toBe('claude-opus-5');
    expect(value.parallelToolCalls).toBe(false);
  });
});

describe('a tool result crossing to a Responses target', () => {
  test('a tool result holding an image at a URL is restated as structured input', () => {
    const result = toolResultHolding(
      { type: 'text', text: 'here it is' },
      { type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } },
    );
    const value = translatedRequest(
      anthropicRequestForResponses(translated(requestOf(result)), undefined),
    );

    expect(firstToolResult(value)?.structuredResult).toStrictEqual([
      { type: 'input_text', text: 'here it is' },
      { type: 'input_image', image_url: 'https://example.test/a.png' },
    ]);
  });

  test('a tool result holding an inline image is restated as a data URL', () => {
    const result = toolResultHolding({
      type: 'image',
      source: { type: 'base64', mediaType: 'image/png', data: 'AAAA' },
    });
    const value = translatedRequest(
      anthropicRequestForResponses(translated(requestOf(result)), undefined),
    );

    expect(firstToolResult(value)?.structuredResult).toStrictEqual([
      { type: 'input_image', image_url: 'data:image/png;base64,AAAA' },
    ]);
  });

  test('a tool result holding only text is left unstructured', () => {
    const result = toolResultHolding({ type: 'text', text: 'plain' });
    const value = translatedRequest(
      anthropicRequestForResponses(translated(requestOf(result)), undefined),
    );

    expect(firstToolResult(value)).toStrictEqual(result);
  });
});

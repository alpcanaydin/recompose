import { describe, expect, it } from 'vitest';

import type {
  AnthropicContentBlock,
  AnthropicRequest,
  AnthropicStreamEvent,
} from './anthropic-wire';
import type { GeminiPart, GeminiResponse } from './gemini-wire';

import {
  decodeGeminiClaudeCarrier,
  encodeGeminiClaudeCarrier,
} from '../provider/gemini-claude-carrier';
import {
  translateRequestToGemini,
  translateResponseFromGemini,
  translateStreamFromGemini,
} from './gemini-bridge';

const first = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const second = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';

describe('Gemini Claude carrier codec', () => {
  it('TestGeminiClaudeCarrierSignatureRoundTrip', () => {
    const encoded = encodeGeminiClaudeCarrier({
      signature: first,
      direction: 'next',
      target: 'text',
    });

    expect(decodeGeminiClaudeCarrier(encoded)).toEqual({
      signature: first,
      direction: 'next',
      target: 'text',
    });
  });

  it('TestStripInvalidGeminiSignatureThinkingBlocksDropsMismatchedDirectionalThinking', () => {
    const content = [carrier(first, 'next', 'function'), textBlock('answer')];

    expect(roundTrip(content).contents[0]?.parts[0]).not.toHaveProperty('thoughtSignature');
  });
});

describe('Gemini Claude visible signature carriers', () => {
  it('TestConvertAntigravityResponseToClaude_VisibleGeminiSignatureUsesLeadingCarrier', () => {
    const content = nonStream([{ text: 'answer', thoughtSignature: first }]);

    expect(content.map(blockType)).toEqual(['thinking', 'text']);
    expect(carrierDirection(content[0])).toBe('next');
  });

  it('TestConvertAntigravityResponseToClaude_DetachedGeminiSignatureAfterVisibleText', async () => {
    const events = await stream([
      response([{ text: 'answer' }]),
      response([{ text: '', thoughtSignature: first }], true),
    ]);

    expect(carrierDirections(events)).toContain('previous');
  });

  it('TestConvertAntigravityResponseToClaudeNonStream_DetachedGeminiSignatureAfterVisibleText', () => {
    const content = nonStream([{ text: 'answer' }, { text: '', thoughtSignature: first }]);

    expect(content.map(blockType)).toEqual(['text', 'thinking']);
    expect(carrierDirection(content[1])).toBe('previous');
  });

  it('TestConvertAntigravityResponseToClaude_DirectionalTextCarriersRoundTrip', () => {
    const firstSigned = nonStream([{ text: 'A', thoughtSignature: first }, { text: 'B' }]);
    const trailing = nonStream([
      { text: 'A' },
      { text: '', thoughtSignature: first },
      { text: 'B' },
    ]);

    expect(carrierDirection(firstSigned[0])).toBe('next');
    expect(carrierDirection(trailing[1])).toBe('previous');
  });
});

describe('Gemini Claude thought and text isolation', () => {
  it('TestConvertAntigravityResponseToClaudeNonStream_SignedThoughtBeforeUnsignedTextKeepsTarget', () => {
    const content = nonStream([
      { text: 'reason', thought: true, thoughtSignature: first },
      { text: 'answer' },
    ]);

    expect(content.map(blockType)).toEqual(['thinking', 'thinking', 'text']);
    expect(carrierDirection(content[0])).toBe('next');
  });

  it('TestConvertAntigravityResponseToClaudeNonStream_PreviousCarrierDoesNotCrossFollowingText', () => {
    const content = nonStream([
      { text: 'A' },
      { text: '', thoughtSignature: first },
      { text: 'B' },
    ]);

    expect(roundTrip(content).contents[0]?.parts).toEqual([
      { text: 'A', thoughtSignature: first },
      { text: 'B' },
    ]);
  });

  it('TestConvertAntigravityResponseToClaudeNonStream_PreservesDistinctThoughtAndTextSignatures', () => {
    const content = nonStream([
      { text: 'reason', thought: true, thoughtSignature: first },
      { text: 'answer', thoughtSignature: second },
    ]);

    expect(carrierSignatures(content)).toEqual([first, second]);
  });

  it('TestConvertAntigravityResponseToClaudeStream_PreservesDistinctThoughtAndTextSignatures', async () => {
    const events = await stream([
      response([{ text: 'reason', thought: true, thoughtSignature: first }]),
      response([{ text: 'answer', thoughtSignature: second }], true),
    ]);

    expect(streamCarrierSignatures(events)).toEqual([first, second]);
  });

  it('TestConvertAntigravityResponseToClaude_LeadingCarrierTargetsFollowingThought', () => {
    const content = nonStream([
      { text: '', thoughtSignature: first },
      { text: 'reason', thought: true },
    ]);

    expect(roundTrip(content).contents[0]?.parts[0]).toMatchObject({
      text: 'reason',
      thought: true,
      thoughtSignature: first,
    });
  });
});

describe('Gemini Claude function signature carriers', () => {
  it('TestConvertAntigravityResponseToClaude_PreservesConsecutiveDetachedCarriers', () => {
    const content = nonStream([
      { text: '', thoughtSignature: first },
      { text: '', thoughtSignature: second },
      { text: 'answer' },
    ]);

    expect(carrierSignatures(content)).toEqual([first, second]);
  });

  it('TestConvertAntigravityResponseToClaudeNonStream_ThoughtBeforeSignedToolRoundTrips', () => {
    const content = nonStream([{ text: 'reason', thought: true }, functionPart(first)]);

    expect(functionSignature(roundTrip(content).contents[0]?.parts ?? [])).toBe(first);
  });

  it('TestConvertAntigravityResponseToClaude_TrailingFunctionCarrierRoundTrip', () => {
    const content = nonStream([functionPart(first), { text: '', thoughtSignature: second }]);

    expect(carrierSignatures(content)).toEqual([first, second]);
  });
});

function nonStream(parts: GeminiPart[]): readonly AnthropicContentBlock[] {
  const translated = translateResponseFromGemini('anthropic', response(parts, true));

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));
  if ('outcome' in translated) throw new Error('unexpected passthrough');

  return translated.value.content.filter(isContentBlock);
}

function roundTrip(content: readonly AnthropicContentBlock[]) {
  const request: AnthropicRequest = {
    model: 'gemini-3.6-flash-high',
    max_tokens: 1024,
    messages: [
      { role: 'assistant', content },
      { role: 'user', content: 'continue' },
    ],
  };
  const translated = translateRequestToGemini('anthropic', request);

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));

  return translated.value;
}

async function stream(responses: GeminiResponse[]): Promise<AnthropicStreamEvent[]> {
  const events: AnthropicStreamEvent[] = [];

  for await (const event of translateStreamFromGemini('anthropic', sourceOf(responses))) {
    events.push(event);
  }

  return events;
}

async function* sourceOf(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  await Promise.resolve();

  for (const value of responses) yield value;
}

function response(parts: GeminiPart[], finished = false): GeminiResponse {
  return {
    candidates: [
      { content: { role: 'model', parts }, ...(finished ? { finishReason: 'STOP' } : {}) },
    ],
  };
}

function functionPart(signature: string): GeminiPart {
  return { functionCall: { id: 'call-1', name: 'run', args: {} }, thoughtSignature: signature };
}

function carrier(
  signature: string,
  direction: 'next' | 'previous',
  target: 'text' | 'function',
): AnthropicContentBlock {
  return {
    type: 'thinking',
    thinking: '',
    signature: encodeGeminiClaudeCarrier({ signature, direction, target }),
  };
}

function textBlock(text: string): AnthropicContentBlock {
  return { type: 'text', text };
}

function isContentBlock(value: unknown): value is AnthropicContentBlock {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function blockType(block: AnthropicContentBlock): string {
  return block.type;
}

function carrierDirection(block: AnthropicContentBlock | undefined): string | undefined {
  return block?.type === 'thinking'
    ? decodeGeminiClaudeCarrier(block.signature)?.direction
    : undefined;
}

function carrierSignatures(content: readonly AnthropicContentBlock[]): string[] {
  return content.flatMap((block) => {
    if (block.type !== 'thinking') return [];

    const decoded = decodeGeminiClaudeCarrier(block.signature);

    return decoded === null ? [] : [decoded.signature];
  });
}

function carrierDirections(events: AnthropicStreamEvent[]): string[] {
  return streamCarriers(events).map((carrier) => carrier.direction);
}

function streamCarrierSignatures(events: AnthropicStreamEvent[]): string[] {
  return streamCarriers(events).map((carrier) => carrier.signature);
}

function streamCarriers(events: AnthropicStreamEvent[]) {
  return events.flatMap((event) => {
    if (event.type !== 'content_block_delta' || !('delta' in event)) return [];
    if (event.delta.type !== 'signature_delta') return [];

    const decoded = decodeGeminiClaudeCarrier(event.delta.signature);

    return decoded === null ? [] : [decoded];
  });
}

function functionSignature(parts: GeminiPart[]): string | undefined {
  return parts.find((part) => part.functionCall !== undefined)?.thoughtSignature;
}

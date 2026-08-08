import { describe, expect, it } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type {
  ResponsesInputItem,
  ResponsesOutputItem,
  ResponsesStreamEvent,
} from './responses-wire';

import { decodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { translateResponseFromGemini, translateStreamFromGemini } from './gemini-bridge';

const first = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const second = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';
const third = 'third-distinct-gemini-signature-123456';

describe('Gemini Responses signed visible boundaries', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_ConsecutiveSignedVisibleTextPreservesEverySignature', async () => {
    const items = await streamItems([
      chunk([{ text: 'one', thoughtSignature: first }]),
      chunk([{ text: 'two', thoughtSignature: second }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_ConsecutiveSignedVisibleTextPreservesEverySignature', () => {
    const output = nonStream([
      { text: 'one', thoughtSignature: first },
      { text: 'two', thoughtSignature: second },
    ]);

    expect(carrierSignatures(output)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_SignedVisibleThenUnsignedPreservesBoundary', async () => {
    const items = await streamItems([
      chunk([{ text: 'signed', thoughtSignature: first }]),
      chunk([{ text: 'unsigned' }], true),
    ]);

    expect(items.map((item) => item.type)).toEqual(['message', 'reasoning', 'message']);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_SignedVisibleThenUnsignedPreservesBoundary', () => {
    const output = nonStream([{ text: 'signed', thoughtSignature: first }, { text: 'unsigned' }]);

    expect(output.map((item) => item.type)).toEqual(['message', 'reasoning', 'message']);
  });
});

describe('Gemini Responses thought and visible signature isolation', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_LeadingCarrierDoesNotCrossSignedThought', async () => {
    const items = await streamItems([
      chunk([{ text: '', thoughtSignature: first }]),
      chunk([{ text: 'reason', thought: true, thoughtSignature: second }]),
      chunk([{ text: 'answer' }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_VisibleSignatureDoesNotOverwriteSignedThought', async () => {
    const items = await streamItems([
      chunk([{ text: 'one', thought: true, thoughtSignature: first }]),
      chunk([{ text: 'answer', thoughtSignature: second }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_FlushesVisibleSignatureBeforeLaterThought', async () => {
    const items = await streamItems([
      chunk([{ text: 'thought-a', thought: true, thoughtSignature: first }]),
      chunk([{ text: 'answer', thoughtSignature: second }]),
      chunk([{ text: 'thought-c', thought: true, thoughtSignature: third }], true),
    ]);

    expect(items.map((item) => item.type)).toEqual([
      'reasoning',
      'message',
      'reasoning',
      'reasoning',
    ]);
  });
});

describe('Gemini Responses signed reasoning identity', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_DistinctSignedThoughtsUseDistinctItems', async () => {
    const items = await streamItems([
      chunk([{ text: 'one', thought: true, thoughtSignature: first }]),
      chunk([{ text: 'two', thought: true, thoughtSignature: second }], true),
    ]);

    expect(items.map((item) => item.type)).toEqual(['reasoning', 'reasoning']);
    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_DistinctSignedThoughtsUseDistinctItems', () => {
    const output = nonStream([
      { text: 'one', thought: true, thoughtSignature: first },
      { text: 'two', thought: true, thoughtSignature: second },
    ]);

    expect(output.map((item) => item.type)).toEqual(['reasoning', 'reasoning']);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_VisibleSignatureCompletesActiveReasoning', async () => {
    const items = await streamItems([
      chunk([{ text: 'hidden thought', thought: true }]),
      chunk([{ text: 'visible answer', thoughtSignature: first }], true),
    ]);

    expect(items.map((item) => item.type)).toEqual(['reasoning', 'message']);
    expect(carrierSignatures(items)).toEqual([first]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_VisibleSignatureCompletesReasoning', () => {
    const output = nonStream([
      { text: 'hidden thought', thought: true },
      { text: 'visible answer', thoughtSignature: first },
    ]);

    expect(output.map((item) => item.type)).toEqual(['reasoning', 'message']);
    expect(carrierSignatures(output)).toEqual([first]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_LateThoughtSignatureIsImmutable', async () => {
    const items = await streamItems([
      chunk([{ text: 'one', thought: true }]),
      chunk([{ text: 'two', thought: true, thoughtSignature: second }], true),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveProperty('summary.0.text', 'onetwo');
    expect(carrierSignatures(items)).toEqual([second]);
  });
});

function chunk(parts: GeminiPart[], finished = false): GeminiResponse {
  return {
    candidates: [
      {
        content: { role: 'model', parts },
        ...(finished ? { finishReason: 'STOP' } : {}),
      },
    ],
  };
}

async function streamItems(responses: GeminiResponse[]): Promise<ResponsesInputItem[]> {
  const events: ResponsesStreamEvent[] = [];

  for await (const event of translateStreamFromGemini('responses', sourceOf(responses))) {
    events.push(event);
  }

  return events.flatMap((event) => terminalItem(event));
}

async function* sourceOf(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  await Promise.resolve();

  for (const response of responses) yield response;
}

function terminalItem(event: ResponsesStreamEvent): ResponsesInputItem[] {
  if (event.type !== 'response.output_item.done' || !('item' in event)) return [];

  return isInputItem(event.item) ? [event.item] : [];
}

function isInputItem(value: unknown): value is ResponsesInputItem {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  return new Set(['message', 'reasoning', 'function_call']).has(String(value.type));
}

function nonStream(parts: GeminiPart[]): readonly ResponsesOutputItem[] {
  const result = translateResponseFromGemini('responses', chunk(parts, true));

  if ('refusal' in result) throw new Error(JSON.stringify(result.refusal));
  if ('outcome' in result) throw new Error('unexpected passthrough');

  return result.value.output;
}

function carrierSignatures(items: readonly ResponsesOutputItem[]): string[];
function carrierSignatures(items: readonly ResponsesInputItem[]): string[];

function carrierSignatures(items: readonly (ResponsesOutputItem | ResponsesInputItem)[]): string[] {
  return items.flatMap((item) => {
    if (item.type !== 'reasoning' || item.encrypted_content === undefined) return [];

    const decoded = decodeGeminiResponsesCarrier(item.encrypted_content);

    return decoded.marked && decoded.valid ? [decoded.signature] : [];
  });
}

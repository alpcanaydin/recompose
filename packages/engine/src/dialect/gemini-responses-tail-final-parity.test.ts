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

describe('Gemini Responses function and trailing signatures', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_FunctionAndTrailingSignaturesRoundTrip', async () => {
    const items = await streamItems([
      chunk([functionPart(first)]),
      chunk([{ text: '', thoughtSignature: second }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_FunctionAndTrailingSignaturesPreserveOrder', () => {
    const output = nonStream([functionPart(first), { text: '', thoughtSignature: second }]);

    expect(output.map((item) => item.type)).toEqual(['reasoning', 'function_call', 'reasoning']);
    expect(carrierSignatures(output)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_FunctionThenTrailingSignatureHasStreamParity', async () => {
    const streamed = await streamItems([
      chunk([functionPart(first)]),
      chunk([{ text: '', thoughtSignature: second }], true),
    ]);
    const nonStreamed = nonStream([functionPart(first), { text: '', thoughtSignature: second }]);

    expect(streamed.map((item) => item.type)).toEqual(nonStreamed.map((item) => item.type));
    expect(carrierSignatures(streamed)).toEqual(carrierSignatures(nonStreamed));
  });

  it('TestConvertGeminiResponseToOpenAIResponses_GeminiToolSignature', async () => {
    const items = await streamItems([chunk([functionPart(first)], true)]);

    expect(items.map((item) => item.type)).toEqual(['reasoning', 'function_call']);
    expect(carrierSignatures(items)).toEqual([first]);
  });
});

describe('Gemini Responses signed text and trailing signatures', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_SignedTextAndTrailingSignatureRoundTripInOrder', async () => {
    const items = await streamItems([
      chunk([{ text: 'signed', thoughtSignature: first }]),
      chunk([{ text: '', thoughtSignature: second }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_SignedTextAndTrailingSignatureRoundTripInOrder', () => {
    const output = nonStream([
      { text: 'signed', thoughtSignature: first },
      { text: '', thoughtSignature: second },
    ]);

    expect(carrierSignatures(output)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_LeadingEmptyAndSignedTextRoundTripInOrder', async () => {
    const items = await streamItems([
      chunk([{ text: '', thoughtSignature: first }]),
      chunk([{ text: 'signed', thoughtSignature: second }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_PreservesMultipleLeadingEmptySignatures', async () => {
    const items = await streamItems([
      chunk([{ text: '', thoughtSignature: first }]),
      chunk([{ text: '', thoughtSignature: second }]),
      chunk([{ text: 'answer' }], true),
    ]);

    expect(carrierSignatures(items)).toEqual([first, second]);
  });
});

describe('Gemini Responses trailing carrier identity independence', () => {
  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_TrailingSignatureFollowsPendingReasoning', () => {
    const output = nonStream([
      { text: 'thought', thought: true, thoughtSignature: first },
      { text: '', thoughtSignature: second },
    ]);

    expect(carrierSignatures(output)).toEqual([first, second]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_UnsignedThoughtDoesNotStealFunctionSignature', () => {
    const output = nonStream([functionPart(first), { text: 'later thought', thought: true }]);

    expect(output.map((item) => item.type)).toEqual(['reasoning', 'function_call', 'reasoning']);
    expect(carrierSignatures(output)).toEqual([first]);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_TrailingCarrierDirectionDoesNotDependOnID', () => {
    const output = nonStream([{ text: 'answer' }, { text: '', thoughtSignature: first }]);

    expect(carrierDirection(output[0])).toBe('next');
  });

  it('TestConvertGeminiResponseToOpenAIResponses_TrailingCarrierDirectionSurvivesStrippedIDs', async () => {
    const items = await streamItems([
      chunk([{ text: 'answer' }]),
      chunk([{ text: '', thoughtSignature: first }], true),
    ]);

    expect(carrierDirection(items[1])).toBe('previous');
  });

  it('TestConvertGeminiResponseToOpenAIResponses_DetachedSignatureAfterVisibleText', async () => {
    const items = await streamItems([
      chunk([{ text: 'visible answer' }]),
      chunk([{ text: '', thoughtSignature: first }], true),
    ]);

    expect(items.map((item) => item.type)).toEqual(['message', 'reasoning']);
  });
});

describe('Gemini Responses terminal lifecycle proofs', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_DoneFinalizesStartedStreamExactlyOnce', async () => {
    const events = await eventsOf([chunk([{ text: 'answer' }])]);

    expect(events.filter((event) => event.type === 'response.completed')).toHaveLength(1);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_FinishReasonThenDoneDoesNotDuplicateCompletion', async () => {
    const events = await eventsOf([chunk([{ text: 'answer' }], true), chunk([], true)]);

    expect(events.filter((event) => event.type === 'response.completed')).toHaveLength(1);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_BareDoneBeforeStartEmitsNothing', async () => {
    expect(await eventsOf([])).toEqual([]);
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

function functionPart(signature: string): GeminiPart {
  return {
    functionCall: { id: 'call-1', name: 'run', args: {} },
    thoughtSignature: signature,
  };
}

async function eventsOf(responses: GeminiResponse[]): Promise<ResponsesStreamEvent[]> {
  const events: ResponsesStreamEvent[] = [];

  for await (const event of translateStreamFromGemini('responses', sourceOf(responses))) {
    events.push(event);
  }

  return events;
}

async function streamItems(responses: GeminiResponse[]): Promise<ResponsesInputItem[]> {
  return (await eventsOf(responses)).flatMap((event) => terminalItem(event));
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

type CarrierItem = ResponsesInputItem | ResponsesOutputItem;

function carrierSignatures(items: readonly CarrierItem[]): string[] {
  return items.flatMap((item) => {
    if (item.type !== 'reasoning' || item.encrypted_content === undefined) return [];

    const decoded = decodeGeminiResponsesCarrier(item.encrypted_content);

    return decoded.marked && decoded.valid ? [decoded.signature] : [];
  });
}

function carrierDirection(item: CarrierItem | undefined): string | undefined {
  if (item === undefined) return undefined;
  if (item.type !== 'reasoning') return undefined;

  return decodedDirection(item.encrypted_content);
}

function decodedDirection(encryptedContent: string | undefined): string | undefined {
  if (encryptedContent === undefined) return undefined;

  const decoded = decodeGeminiResponsesCarrier(encryptedContent);

  return decoded.marked && decoded.valid ? decoded.direction : undefined;
}

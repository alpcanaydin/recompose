import { describe, expect, it } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { ResponsesInputItem, ResponsesStreamEvent } from './responses-wire';

import { decodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import {
  translateRequestToGemini,
  translateResponseFromGemini,
  translateStreamFromGemini,
} from './gemini-bridge';

const textSignature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const toolSignature = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';
const reasoningSignature =
  'RXE0RENrZ0lDeEFDR0FJcVFOZDdjUzlleGFuRktRdFcvSzNyZ2MvWDNCcDQ4RmxSbGxOWUlOVU5kR1l1UHMrMGdkMVp0Vkg3ekdKU0g4YVljc2JjN3lNK0FrdGpTNUdqamI4T3Z0VVNETzdQd3pmcFhUOGl3U3hXUEJvTVFRQ09mWTFyMEtTWGZxUUlJakFqdmFGWk83RW1XRlBKckJVOVpkYzdDKw==';

describe('Gemini Responses reasoning carrier envelopes', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_ReasoningEncryptedContent', async () => {
    const events = await streamEvents([
      response([{ thought: true, thoughtSignature: reasoningSignature, text: '' }]),
      response([{ thought: true, text: 'a' }]),
      response([{ text: 'hello' }], true),
    ]);
    const reasoning = terminalItems(events).filter((item) => item.type === 'reasoning');
    const encrypted =
      reasoning[0]?.type === 'reasoning' ? reasoning[0].encrypted_content : undefined;

    expect(decodedSignature(encrypted)).toBe(reasoningSignature);
    expect(addedReasoningSignature(events)).toBe(encrypted);
  });
});

describe('Gemini Responses pending function signatures', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_PendingSignatureBeforeFunctionRoundTrips', async () => {
    const events = await streamEvents([
      response([{ text: '', thoughtSignature: textSignature }]),
      response([functionPart('native-pending-call', 'run_command', toolArgs())], true),
    ]);
    const items = terminalItems(events);
    const call = functionItem(items);
    const translated = roundTrip(items, call?.call_id);
    const parts = translated.contents[0]?.parts ?? [];

    expect(emptySignedParts(parts)).toHaveLength(0);
    expect(functionParts(parts)[0]?.thoughtSignature).toBe(textSignature);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_SignedTextBeforeSignedFunctionRoundTrips', async () => {
    const events = await streamEvents([
      response([{ text: 'before ' }]),
      response([{ text: 'tool', thoughtSignature: textSignature }]),
      response([functionPart(undefined, 'run_command', toolArgs(), toolSignature)], true),
    ]);
    const items = terminalItems(events);
    const translated = roundTrip(items, functionItem(items)?.call_id);
    const parts = translated.contents[0]?.parts ?? [];

    expect(signatureForText(parts, 'before tool')).toBe(textSignature);
    expect(functionParts(parts)[0]?.thoughtSignature).toBe(toolSignature);
  });
});

describe('Gemini Responses non-stream signed function boundaries', () => {
  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_PreservesTextAroundSignedFunction', () => {
    const output = nonStreamOutput([
      { text: 'preface' },
      functionPart(undefined, 'run_command', toolArgs(), textSignature),
      { text: 'after' },
    ]);

    expect(output.map((item) => item.type)).toEqual([
      'message',
      'reasoning',
      'function_call',
      'message',
    ]);
    expect(output[3]).toHaveProperty('content.0.text', 'after');
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_DetachedSignature', () => {
    const output = nonStreamOutput([
      { text: 'visible answer' },
      { text: '', thoughtSignature: textSignature },
    ]);

    expect(output.map((item) => item.type)).toEqual(['reasoning', 'message']);
    expect(output[0]).toHaveProperty('encrypted_content');
    expect(output[1]).toHaveProperty('content.0.text', 'visible answer');
  });
});

function response(parts: GeminiPart[], finished = false): GeminiResponse {
  return {
    candidates: [
      {
        content: { role: 'model', parts },
        ...(finished ? { finishReason: 'STOP' } : {}),
      },
    ],
  };
}

async function streamEvents(responses: GeminiResponse[]): Promise<ResponsesStreamEvent[]> {
  const events: ResponsesStreamEvent[] = [];

  for await (const event of translateStreamFromGemini('responses', sourceOf(responses))) {
    events.push(event);
  }

  return events;
}

async function* sourceOf(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  await Promise.resolve();

  for (const value of responses) yield value;
}

function terminalItems(events: ResponsesStreamEvent[]): ResponsesInputItem[] {
  return events.flatMap((event) => {
    if (event.type !== 'response.output_item.done' || !('item' in event)) return [];

    return isInputItem(event.item) ? [event.item] : [];
  });
}

function isInputItem(value: unknown): value is ResponsesInputItem {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  return new Set(['message', 'reasoning', 'function_call']).has(String(value.type));
}

function functionItem(items: ResponsesInputItem[]) {
  return items.find((item) => item.type === 'function_call');
}

function roundTrip(items: ResponsesInputItem[], callId: string | undefined) {
  const input =
    callId === undefined
      ? items
      : [...items, { type: 'function_call_output' as const, call_id: callId, output: 'ok' }];
  const translated = translateRequestToGemini('responses', { model: 'alias', input });

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));

  return translated.value;
}

function decodedSignature(encrypted: string | undefined): string | undefined {
  if (encrypted === undefined) return undefined;

  const decoded = decodeGeminiResponsesCarrier(encrypted);

  return decoded.marked && decoded.valid ? decoded.signature : undefined;
}

function addedReasoningSignature(events: ResponsesStreamEvent[]): string | undefined {
  for (const event of events) {
    if (event.type !== 'response.output_item.added' || !('item' in event)) continue;
    if (event.item.type === 'reasoning') return event.item.encrypted_content;
  }

  return undefined;
}

function emptySignedParts(parts: GeminiPart[]): GeminiPart[] {
  return parts.filter((part) => part.text === '' && part.thoughtSignature !== undefined);
}

function signatureForText(parts: GeminiPart[], text: string): string | undefined {
  return parts.find((part) => part.text === text)?.thoughtSignature;
}

function functionPart(
  id: string | undefined,
  name: string,
  args: Record<string, unknown>,
  signature?: string,
): GeminiPart {
  return {
    functionCall: { name, args, ...(id === undefined ? {} : { id }) },
    ...(signature === undefined ? {} : { thoughtSignature: signature }),
  };
}

function toolArgs(): Record<string, unknown> {
  return { command: 'true' };
}

function functionParts(parts: GeminiPart[]): GeminiPart[] {
  return parts.filter((part) => part.functionCall !== undefined);
}

function nonStreamOutput(parts: GeminiPart[]) {
  const translated = translateResponseFromGemini('responses', response(parts, true));

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));
  if ('outcome' in translated) throw new Error('unexpected passthrough');

  return translated.value.output;
}

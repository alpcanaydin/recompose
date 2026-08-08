import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';
import type { ResponsesInputItem, ResponsesRequest, ResponsesStreamEvent } from './responses-wire';

import { decodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import {
  translateRequestToGemini,
  translateResponseFromGemini,
  translateStreamFromGemini,
} from './gemini-bridge';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

type GeminiParts = NonNullable<
  NonNullable<GeminiResponse['candidates']>[number]['content']
>['parts'];

describe('Gemini Responses visible-text signature carriers', () => {
  it('should round-trip a signature attached to visible text', () => {
    const response = translatedResponse([{ text: 'answer', thoughtSignature: signature }]);
    const responseItems = inputItems(response.value.output);
    const request = requestFrom(responseItems);
    const translated = translateRequestToGemini('responses', request);

    expect(response.value.output.map((item) => item.type)).toEqual(['message', 'reasoning']);
    expect(carrierAt(responseItems, 1)).toMatchObject({
      marked: true,
      valid: true,
      signature,
      direction: 'previous',
      target: 'text',
    });
    expect(translated).toHaveProperty('value.contents.0.parts.0', {
      text: 'answer',
      thoughtSignature: signature,
    });
  });

  it('should attach a detached signature to preceding visible text', () => {
    const response = translatedResponse([{ text: 'answer' }, { thoughtSignature: signature }]);
    const translated = translateRequestToGemini(
      'responses',
      requestFrom(inputItems(response.value.output)),
    );

    expect(response.value.output.map((item) => item.type)).toEqual(['reasoning', 'message']);
    expect(translated).toHaveProperty('value.contents.0.parts.0', {
      text: 'answer',
      thoughtSignature: signature,
    });
  });
});

describe('Gemini Responses streaming visible-text signature carriers', () => {
  it('should preserve a signed visible-text boundary in a stream', async () => {
    const events = await collect(
      translateStreamFromGemini(
        'responses',
        providerStream([{ text: 'answer', thoughtSignature: signature }]),
      ),
    );
    const items = terminalItems(events);
    const translated = translateRequestToGemini(
      'responses',
      requestFrom([...items, messageItem('user', 'follow up')]),
    );

    expect(items.map((item) => item.type)).toEqual(['message', 'reasoning']);
    expect(carrierAt(items, 1)).toMatchObject({ direction: 'previous', target: 'text' });
    expect(translated).toHaveProperty('value.contents.0.parts.0', {
      text: 'answer',
      thoughtSignature: signature,
    });
  });
});

describe('Gemini Responses detached streaming text signatures', () => {
  it('should attach a detached streaming signature to preceding visible text', async () => {
    const events = await collect(
      translateStreamFromGemini(
        'responses',
        providerChunks([{ text: 'answer' }], [{ text: '', thoughtSignature: signature }]),
      ),
    );
    const items = terminalItems(events);
    const translated = translateRequestToGemini(
      'responses',
      requestFrom([...items, messageItem('user', 'follow up')]),
    );

    expect(items.map((item) => item.type)).toEqual(['message', 'reasoning']);
    expect(translated).toHaveProperty('value.contents.0.parts.0', {
      text: 'answer',
      thoughtSignature: signature,
    });
  });

  it('should keep unsigned text after signed text in a separate boundary', async () => {
    const events = await collect(
      translateStreamFromGemini(
        'responses',
        providerChunks([{ text: 'signed', thoughtSignature: signature }], [{ text: 'unsigned' }]),
      ),
    );
    const items = terminalItems(events);
    const translated = translateRequestToGemini(
      'responses',
      requestFrom([...items, messageItem('user', 'follow up')]),
    );

    expect(items.map((item) => item.type)).toEqual(['message', 'reasoning', 'message']);
    expect(translated).toHaveProperty('value.contents.0.parts', [
      { text: 'signed', thoughtSignature: signature },
      { text: 'unsigned' },
    ]);
  });
});

function translatedResponse(parts: GeminiParts) {
  const translated = translateResponseFromGemini('responses', providerResponse(parts));

  if ('refusal' in translated) throw new Error('Gemini response met a refusal');
  if ('outcome' in translated) throw new Error('Gemini response passed through');

  return translated;
}

function providerResponse(parts: GeminiParts): GeminiResponse {
  return { candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] };
}

async function* providerStream(parts: GeminiParts): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield providerResponse(parts);
}

async function* providerChunks(
  first: GeminiParts,
  last: GeminiParts,
): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield { candidates: [{ content: { role: 'model', parts: first } }] };
  yield providerResponse(last);
}

function requestFrom(input: readonly ResponsesInputItem[]): ResponsesRequest {
  return { model: 'alias-without-provider-name', input: [...input] };
}

function inputItems(values: readonly unknown[]): ResponsesInputItem[] {
  return values.filter(isInputItem);
}

function messageItem(role: 'user' | 'assistant', text: string): ResponsesInputItem {
  return {
    type: 'message',
    role,
    content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
  };
}

function carrierAt(items: readonly ResponsesInputItem[], index: number) {
  const item = items[index];

  if (item?.type !== 'reasoning' || typeof item.encrypted_content !== 'string') {
    throw new Error(`carrier missing at index ${String(index)}`);
  }

  return decodeGeminiResponsesCarrier(item.encrypted_content);
}

async function collect(source: AsyncIterable<ResponsesStreamEvent>) {
  const events: ResponsesStreamEvent[] = [];

  for await (const event of source) events.push(event);

  return events;
}

function terminalItems(events: readonly ResponsesStreamEvent[]): ResponsesInputItem[] {
  return events.flatMap((event) => {
    if (event.type !== 'response.output_item.done' || !('item' in event)) return [];

    return isInputItem(event.item) ? [event.item] : [];
  });
}

function isInputItem(value: unknown): value is ResponsesInputItem {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  const type = value.type;

  return type === 'message' || type === 'reasoning';
}

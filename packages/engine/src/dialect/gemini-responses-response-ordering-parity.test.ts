import { describe, expect, it } from 'vitest';

import type { GeminiPart, GeminiResponse } from './gemini-wire';
import type { ResponsesOutputItem, ResponsesStreamEvent } from './responses-wire';

import { translateResponseFromGemini, translateStreamFromGemini } from './gemini-bridge';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

describe('Gemini Responses aggregated text ordering', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_UnwrapAndAggregateText', async () => {
    const events = await eventsOf([
      chunk([{ text: '' }]),
      chunk([{ text: '让' }]),
      chunk([{ text: '我先' }]),
      chunk([{ text: '了解' }]),
      chunk([functionPart('toolu_1', 'list_dir', { recursive: false })]),
      chunk([{ text: '' }], true),
    ]);

    expect(doneText(events)).toBe('让我先了解');
    expect(eventPosition(events, 'response.output_text.done')).toBeLessThan(
      eventPosition(events, 'response.content_part.done'),
    );
    expect(doneTypes(events)).toEqual(['message', 'function_call']);
  });

  it('TestConvertGeminiResponseToOpenAIResponses_PreservesTextAroundFunction', async () => {
    const events = await eventsOf([
      chunk([{ text: 'before' }]),
      chunk([functionPart('call-1', 'run', {})]),
      chunk([{ text: 'after' }], true),
    ]);

    expect(completedTypes(events)).toEqual(['message', 'function_call', 'message']);
    expect(completedTexts(events)).toEqual(['before', 'after']);
  });
});

describe('Gemini Responses interleaved thought and text order', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_InterleavedThoughtAndTextPreservesOrder', async () => {
    const events = await eventsOf([
      chunk(
        [
          { text: 'thought-a', thought: true, thoughtSignature: signature },
          { text: 'answer-a' },
          { text: 'thought-b', thought: true, thoughtSignature: signature },
          { text: 'answer-b' },
        ],
        true,
      ),
    ]);

    expect(doneTypes(events)).toEqual(['reasoning', 'message', 'reasoning', 'message']);
    expect(completedTypes(events)).toEqual(['reasoning', 'message', 'reasoning', 'message']);
  });

  it('TestConvertGeminiResponseToOpenAIResponsesNonStream_InterleavedThoughtAndTextPreservesOrder', () => {
    const output = nonStreamOutput([
      { text: 'thought-a', thought: true, thoughtSignature: signature },
      { text: 'answer-a' },
      { text: 'thought-b', thought: true, thoughtSignature: signature },
      { text: 'answer-b' },
    ]);

    expect(output.map((item) => item.type)).toEqual([
      'reasoning',
      'message',
      'reasoning',
      'message',
    ]);
  });
});

describe('Gemini Responses function event ordering', () => {
  it('TestConvertGeminiResponseToOpenAIResponses_FunctionCallEventOrder', async () => {
    const events = await eventsOf([
      chunk(
        [
          functionPart(undefined, 'tool0', {}),
          functionPart(undefined, 'tool1', {}),
          functionPart(undefined, 'tool2', { a: 1 }),
        ],
        true,
      ),
    ]);

    expect(functionEventTypes(events, 0)).toEqual([
      'response.output_item.added',
      'response.function_call_arguments.delta',
      'response.function_call_arguments.done',
      'response.output_item.done',
    ]);
    expect(functionEventTypes(events, 1)).toEqual(functionEventTypes(events, 0));
    expect(functionEventTypes(events, 2)).toEqual(functionEventTypes(events, 0));
  });

  it('TestConvertGeminiResponseToOpenAIResponses_ResponseOutputOrdering', async () => {
    const events = await eventsOf([
      chunk([functionPart(undefined, 'tool0', { x: 'y' })]),
      chunk([{ text: 'hi' }], true),
    ]);

    expect(completedTypes(events)).toEqual(['function_call', 'message']);
    expect(eventPosition(events, 'response.output_item.done')).toBeLessThan(
      eventPosition(events, 'response.output_item.added', 'message'),
    );
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

function functionPart(
  id: string | undefined,
  name: string,
  args: Record<string, unknown>,
): GeminiPart {
  return { functionCall: { name, args, ...(id === undefined ? {} : { id }) } };
}

async function eventsOf(responses: GeminiResponse[]): Promise<ResponsesStreamEvent[]> {
  const events: ResponsesStreamEvent[] = [];

  for await (const event of translateStreamFromGemini('responses', sourceOf(responses))) {
    events.push(event);
  }

  return events;
}

async function* sourceOf(responses: GeminiResponse[]): AsyncIterable<GeminiResponse> {
  await Promise.resolve();

  for (const response of responses) yield response;
}

function doneText(events: ResponsesStreamEvent[]): string | undefined {
  for (const event of events) {
    if (event.type !== 'response.output_text.done' || !('text' in event)) continue;

    return typeof event.text === 'string' ? event.text : undefined;
  }

  return undefined;
}

function doneTypes(events: ResponsesStreamEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === 'response.output_item.done' && 'item' in event ? [event.item.type] : [],
  );
}

function completedOutput(events: ResponsesStreamEvent[]): readonly ResponsesOutputItem[] {
  for (const event of events) {
    if (event.type !== 'response.completed' || !('response' in event)) continue;

    return event.response.output;
  }

  return [];
}

function completedTypes(events: ResponsesStreamEvent[]): string[] {
  return completedOutput(events).map((item) => item.type);
}

function completedTexts(events: ResponsesStreamEvent[]): string[] {
  return completedOutput(events).flatMap((item) => {
    if (item.type !== 'message') return [];

    return item.content.map((part) => part.text);
  });
}

function eventPosition(
  events: ResponsesStreamEvent[],
  type: ResponsesStreamEvent['type'],
  itemType?: string,
): number {
  return events.findIndex((event) => {
    if (event.type !== type) return false;
    if (itemType === undefined || !('item' in event)) return true;

    return event.item.type === itemType;
  });
}

function functionEventTypes(events: ResponsesStreamEvent[], index: number): string[] {
  return events.flatMap((event) =>
    'output_index' in event && event.output_index === index ? [event.type] : [],
  );
}

function nonStreamOutput(parts: GeminiPart[]) {
  const translated = translateResponseFromGemini('responses', chunk(parts, true));

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));
  if ('outcome' in translated) throw new Error('unexpected passthrough');

  return translated.value.output;
}

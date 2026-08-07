import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';
import type { ResponsesInputItem, ResponsesRequest, ResponsesStreamEvent } from './responses-wire';

import { translateRequestToGemini, translateStreamFromGemini } from './gemini-bridge';

const wrappedUuidSignature = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';

describe('Gemini Responses streaming function-call signature carriers', () => {
  it('should round-trip a wrapped UUID signature through terminal stream items', async () => {
    const events = await collect(translateStreamFromGemini('responses', providerStream()));
    const items = terminalInputItems(events);
    const call = items.find((item) => item.type === 'function_call');

    if (call?.type !== 'function_call') throw new Error('streamed function call is missing');

    const request: ResponsesRequest = {
      model: 'alias-without-provider-name',
      input: [...items, { type: 'function_call_output', call_id: call.call_id, output: 'ok' }],
    };
    const translated = translateRequestToGemini('responses', request);

    expect(items.map((item) => item.type)).toEqual(['reasoning', 'function_call']);
    expect(translated).toHaveProperty(
      'value.contents.0.parts.0.thoughtSignature',
      wrappedUuidSignature,
    );
    expect(translated).toHaveProperty('value.contents.0.parts.0.functionCall.name', 'run');
    expect(translated).toHaveProperty('value.contents.0.parts.0.functionCall.args.command', 'true');
    expect(JSON.stringify(translated)).not.toContain('cpa-gemini-responses-carrier-v1:');
  });
});

// Helpers

async function* providerStream(): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [
            {
              functionCall: { id: 'native-call', name: 'run', args: { command: 'true' } },
              thoughtSignature: wrappedUuidSignature,
            },
          ],
        },
        finishReason: 'STOP',
      },
    ],
  };
}

async function collect(source: AsyncIterable<ResponsesStreamEvent>) {
  const events: ResponsesStreamEvent[] = [];

  for await (const event of source) events.push(event);

  return events;
}

function terminalInputItems(events: readonly ResponsesStreamEvent[]): ResponsesInputItem[] {
  const items: ResponsesInputItem[] = [];

  for (const event of events) {
    const item = terminalInputItem(event);

    if (item !== null) items.push(item);
  }

  return items;
}

function terminalInputItem(event: ResponsesStreamEvent): ResponsesInputItem | null {
  if (event.type !== 'response.output_item.done' || !('item' in event)) return null;

  return inputItem(event.item);
}

function inputItem(value: unknown): ResponsesInputItem | null {
  if (!isRecord(value)) return null;

  return reasoningItem(value) ?? functionItem(value);
}

function reasoningItem(value: Record<string, unknown>): ResponsesInputItem | null {
  if (value['type'] !== 'reasoning' || typeof value['encrypted_content'] !== 'string') return null;

  return {
    type: 'reasoning',
    encrypted_content: value['encrypted_content'],
    ...(typeof value['id'] === 'string' ? { id: value['id'] } : {}),
  };
}

function functionItem(value: Record<string, unknown>): ResponsesInputItem | null {
  if (value['type'] !== 'function_call') return null;
  if (typeof value['call_id'] !== 'string') return null;
  if (typeof value['name'] !== 'string') return null;
  if (typeof value['arguments'] !== 'string') return null;

  return {
    type: 'function_call',
    call_id: value['call_id'],
    name: value['name'],
    arguments: value['arguments'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { describe, expect, it } from 'vitest';

import type { Crossing, JsonObject } from '../gateway-wire';

import { filterXAIInternalSearchResponse } from './xai-search-response';

function ownedCrossing(clientTools: readonly string[] = []): Crossing {
  return {
    dialect: 'responses',
    raw: {},
    gatewayName: 'Test',
    virtualModel: 'fast',
    providerModel: 'grok-4.3',
    xaiSearchOwnership: { clientTools },
  };
}

function streamOf(lines: readonly string[]): Response {
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/event-stream' } });
}

function eventStream(events: readonly JsonObject[]): Response {
  return streamOf(events.map((event) => `data: ${JSON.stringify(event)}\n`));
}

async function filteredText(response: Response): Promise<string> {
  return filterXAIInternalSearchResponse(response, ownedCrossing()).text();
}

function internalCall(overrides: JsonObject = {}): JsonObject {
  return {
    id: 'ctc_1',
    type: 'custom_tool_call',
    call_id: 'xs_call-1',
    name: 'x_user_search',
    ...overrides,
  };
}

describe('Passing xAI stream lines the search filter does not own', () => {
  it('should return a response that carries no body unchanged', () => {
    const response = new Response(null, { status: 204 });

    expect(filterXAIInternalSearchResponse(response, ownedCrossing())).toBe(response);
  });

  it('should pass a line that opens no event through untouched', async () => {
    await expect(filteredText(streamOf(['event: response.completed\n']))).resolves.toContain(
      'event: response.completed',
    );
  });

  it('should pass a data line that is not JSON through untouched', async () => {
    await expect(filteredText(streamOf(['data: [DONE]\n']))).resolves.toContain('data: [DONE]');
  });

  it('should keep the upstream status while filtering', () => {
    const response = new Response('data: {}\n', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'text/event-stream' },
    });

    expect(filterXAIInternalSearchResponse(response, ownedCrossing()).status).toBe(201);
  });
});

describe('Dropping the events that follow an internal xAI search call', () => {
  it('should drop later events that name a dropped call even without an index', async () => {
    const text = await filteredText(
      eventStream([
        { type: 'response.output_item.added', item: internalCall() },
        { type: 'response.custom_tool_call_input.done', item_id: 'ctc_1', input: '{}' },
        { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'answer' },
      ]),
    );

    expect(text).not.toContain('ctc_1');
    expect(text).toContain('msg_1');
  });

  it('should ignore an identity field that is not a name', async () => {
    const text = await filteredText(
      eventStream([
        { type: 'response.output_item.added', item: internalCall({ id: '', call_id: 7 }) },
        { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'answer' },
      ]),
    );

    expect(text).toContain('msg_1');
  });

  it('should close the gap the dropped call left in the output order', async () => {
    const text = await filteredText(
      eventStream([
        { type: 'response.output_item.added', output_index: 0, item: internalCall() },
        { type: 'response.output_text.delta', output_index: 1, item_id: 'msg_1', delta: 'a' },
      ]),
    );

    expect(text).toContain('"output_index":0');
  });

  it('should leave an event that names no output position where it is', async () => {
    const text = await filteredText(
      eventStream([
        { type: 'response.output_item.added', output_index: 0, item: internalCall() },
        { type: 'response.output_text.delta', item_id: 'msg_1', delta: 'a' },
      ]),
    );

    expect(text).not.toContain('output_index');
  });

  it('should leave an event that precedes the dropped call at its position', async () => {
    const text = await filteredText(
      eventStream([
        { type: 'response.output_item.added', output_index: 1, item: internalCall() },
        { type: 'response.output_text.delta', output_index: 0, item_id: 'msg_1', delta: 'a' },
      ]),
    );

    expect(text).toContain('"output_index":0');
  });
});

describe('Filtering the completed xAI answer', () => {
  it('should leave a completion whose answer is not an object alone', async () => {
    const text = await filteredText(
      eventStream([{ type: 'response.completed', response: 'gone' }]),
    );

    expect(text).toContain('"response":"gone"');
  });

  it('should leave a completion whose output is not a list alone', async () => {
    const text = await filteredText(
      eventStream([{ type: 'response.completed', response: { output: 'none' } }]),
    );

    expect(text).toContain('"output":"none"');
  });

  it('should keep an output entry that is not an item', async () => {
    const text = await filteredText(
      eventStream([{ type: 'response.completed', response: { output: ['raw'] } }]),
    );

    expect(text).toContain('"output":["raw"]');
  });
});

describe('Telling an internal xAI search call from a caller tool', () => {
  it('should keep a call the caller placed under a namespace', async () => {
    const text = await filteredText(
      eventStream([
        {
          type: 'response.output_item.done',
          item: internalCall({ call_id: 'call_plain', namespace: 'acme' }),
        },
      ]),
    );

    expect(text).toContain('x_user_search');
  });

  it('should keep a call whose name the search tools never claim', async () => {
    const text = await filteredText(
      eventStream([{ type: 'response.output_item.done', item: internalCall({ name: 'lookup' }) }]),
    );

    expect(text).toContain('lookup');
  });

  it('should keep an item of a kind that is not a tool call', async () => {
    const text = await filteredText(
      eventStream([{ type: 'response.output_item.done', item: internalCall({ type: 'message' }) }]),
    );

    expect(text).toContain('x_user_search');
  });

  it('should keep a call whose name arrived as something other than text', async () => {
    const text = await filteredText(
      eventStream([{ type: 'response.output_item.done', item: internalCall({ name: 7 }) }]),
    );

    expect(text).toContain('"name":7');
  });

  it('should drop an unprefixed internal call the caller never declared', async () => {
    const text = await filteredText(
      eventStream([
        { type: 'response.output_item.done', item: internalCall({ call_id: 'call_plain' }) },
      ]),
    );

    expect(text).not.toContain('x_user_search');
  });
});

describe('Respecting a caller tool that shares an internal xAI search name', () => {
  it('should keep the call the caller declared under the shared name', async () => {
    const owned = ownedCrossing(['custom\0\0x_user_search']);
    const stream = eventStream([
      { type: 'response.output_item.done', item: internalCall({ call_id: 'call_plain' }) },
    ]);

    const text = await filterXAIInternalSearchResponse(stream, owned).text();

    expect(text).toContain('x_user_search');
  });
});

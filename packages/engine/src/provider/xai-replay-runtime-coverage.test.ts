import { afterEach, describe, expect, test } from 'vitest';

import type { Crossing, JsonObject, ProxyDialect } from '../gateway-wire';

import { clearXAIReplayCache, observeXAIReplay, prepareXAIReplay } from './xai-replay-runtime';

function crossingFor(dialect: ProxyDialect, replayScopeId?: string): Crossing {
  return {
    dialect,
    raw: {},
    gatewayName: 'grok',
    virtualModel: 'grok-fast',
    providerModel: 'grok-4.3',
    ...(replayScopeId === undefined ? {} : { replayScopeId }),
  };
}

function doneLine(index: unknown, item: unknown): string {
  return `data: ${JSON.stringify({ type: 'response.output_item.done', output_index: index, item })}`;
}

function completedLine(response?: unknown): string {
  return `data: ${JSON.stringify({ type: 'response.completed', ...(response === undefined ? {} : { response }) })}`;
}

function reasoning(content: string): JsonObject {
  return { type: 'reasoning', encrypted_content: content };
}

function eventStream(lines: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`));
      controller.close();
    },
  });

  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

async function replayedInput(crossing: Crossing, lines: readonly string[]): Promise<unknown> {
  const observed = observeXAIReplay(crossing, eventStream(lines));

  await observed.text();

  const prepared = prepareXAIReplay(crossing, {
    input: [{ type: 'message', role: 'user', content: 'next turn' }],
  });

  return prepared['input'];
}

const userTurn = { type: 'message', role: 'user', content: 'next turn' };

afterEach(() => {
  clearXAIReplayCache();
});

describe('the dialects that carry an xAI replay scope', () => {
  test('a chat-completions crossing has no replay scope, so its body is left alone', () => {
    const body: JsonObject = { input: [userTurn] };

    expect(prepareXAIReplay(crossingFor('chat-completions', 'scope-chat'), body)).toBe(body);
  });

  test('an anthropic crossing without a scope id is left alone too', () => {
    const body: JsonObject = { input: [userTurn] };

    expect(prepareXAIReplay(crossingFor('anthropic'), body)).toBe(body);
  });

  test('a responses crossing with a scope id is taken through the replay cache', () => {
    const body: JsonObject = { input: [userTurn] };

    expect(prepareXAIReplay(crossingFor('responses', 'scope-responses'), body)).toEqual(body);
  });
});

describe('what a completed xAI stream leaves behind for the next turn', () => {
  test('items collected out of order replay in output_index order', async () => {
    const input = await replayedInput(crossingFor('responses', 'scope-order'), [
      doneLine(1, reasoning('second')),
      doneLine(0, reasoning('first')),
      completedLine({}),
    ]);

    expect(input).toEqual([reasoning('first'), reasoning('second'), userTurn]);
  });

  test('the output the completed response names wins over the collected items', async () => {
    const input = await replayedInput(crossingFor('responses', 'scope-authoritative'), [
      doneLine(0, reasoning('collected')),
      completedLine({ output: [reasoning('authoritative')] }),
    ]);

    expect(input).toEqual([reasoning('authoritative'), userTurn]);
  });

  test('a completed response carrying no response envelope falls back to the collected items', async () => {
    const input = await replayedInput(crossingFor('anthropic', 'scope-no-envelope'), [
      doneLine(0, reasoning('collected')),
      completedLine(),
    ]);

    expect(input).toEqual([reasoning('collected'), userTurn]);
  });

  test('an output that is not a list falls back to the collected items', async () => {
    const input = await replayedInput(crossingFor('anthropic', 'scope-output-shape'), [
      doneLine(0, reasoning('collected')),
      completedLine({ output: 'not a list' }),
    ]);

    expect(input).toEqual([reasoning('collected'), userTurn]);
  });

  test('a stream that never completes leaves the next turn with nothing to replay', async () => {
    const input = await replayedInput(crossingFor('responses', 'scope-unfinished'), [
      doneLine(0, reasoning('never committed')),
    ]);

    expect(input).toEqual([userTurn]);
  });
});

describe('the stream noise the xAI observer steps over', () => {
  test('comments, non-JSON payloads and malformed items leave the sound item standing', async () => {
    const input = await replayedInput(crossingFor('responses', 'scope-noise'), [
      ': keep-alive',
      'event: response.output_item.done',
      'data: [DONE]',
      'data: not json at all',
      doneLine('zero', reasoning('indexed by text')),
      doneLine(1, 'an item that is not an object'),
      doneLine(0, reasoning('sound')),
      completedLine({}),
    ]);

    expect(input).toEqual([reasoning('sound'), userTurn]);
  });
});

describe('the responses an xAI observer declines to wrap', () => {
  test('a crossing without a replay scope hands its response straight back', () => {
    const response = eventStream([completedLine({})]);

    expect(observeXAIReplay(crossingFor('chat-completions', 'scope-declined'), response)).toBe(
      response,
    );
  });

  test('a failed response is handed straight back', () => {
    const response = new Response('upstream refused', {
      status: 502,
      headers: { 'content-type': 'text/event-stream' },
    });

    expect(observeXAIReplay(crossingFor('responses', 'scope-failed'), response)).toBe(response);
  });

  test('a response that is not an event stream is handed straight back', () => {
    const response = new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect(observeXAIReplay(crossingFor('responses', 'scope-json'), response)).toBe(response);
  });

  test('a streaming response with no body at all is handed straight back', () => {
    const response = new Response(null, {
      status: 204,
      headers: { 'content-type': 'text/event-stream' },
    });

    expect(observeXAIReplay(crossingFor('responses', 'scope-bodiless'), response)).toBe(response);
  });

  test('an observed stream still hands every byte to the caller unchanged', async () => {
    const lines = [doneLine(0, reasoning('kept')), completedLine({})];
    const observed = observeXAIReplay(
      crossingFor('responses', 'scope-passthrough'),
      eventStream(lines),
    );
    const served = await observed.text();

    expect(observed.status).toBe(200);
    expect(served).toBe(`${lines.join('\n')}\n`);
  });
});

describe('clearing the xAI replay cache', () => {
  test('a cleared cache leaves the next turn nothing to replay', async () => {
    const crossing = crossingFor('responses', 'scope-cleared');
    const observed = observeXAIReplay(
      crossing,
      eventStream([doneLine(0, reasoning('committed')), completedLine({})]),
    );

    await observed.text();
    clearXAIReplayCache();

    expect(prepareXAIReplay(crossing, { input: [userTurn] })['input']).toEqual([userTurn]);
  });
});

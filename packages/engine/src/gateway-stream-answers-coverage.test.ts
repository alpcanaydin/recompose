import { describe, expect, it } from 'vitest';

import type { Crossing, JsonObject, ProviderDialect, ProxyDialect } from './gateway-wire';

import { translatedStreamBody } from './gateway-stream-answers';

const targetMarkers: Readonly<Record<ProxyDialect, readonly string[]>> = {
  anthropic: ['event: message_start', '"model":"provider-model"'],
  'chat-completions': ['"choices"', '"delta"', 'data: [DONE]'],
  gemini: ['"candidates"'],
  interactions: ['"event_type"'],
  responses: ['event: response.completed', '"model":"virtual-model"'],
};

const crossings: readonly (readonly [ProviderDialect, ProxyDialect])[] = [
  ['gemini', 'chat-completions'],
  ['gemini', 'anthropic'],
  ['gemini', 'interactions'],
  ['gemini', 'responses'],
  ['chat-completions', 'anthropic'],
  ['chat-completions', 'interactions'],
  ['chat-completions', 'gemini'],
  ['chat-completions', 'responses'],
  ['anthropic', 'chat-completions'],
  ['anthropic', 'interactions'],
  ['anthropic', 'gemini'],
  ['anthropic', 'responses'],
  ['responses', 'chat-completions'],
  ['responses', 'interactions'],
  ['responses', 'gemini'],
  ['responses', 'anthropic'],
  ['interactions', 'chat-completions'],
  ['interactions', 'anthropic'],
  ['interactions', 'gemini'],
  ['interactions', 'responses'],
];

function anthropicWire(): readonly JsonObject[] {
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'upstream-model',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 3, output_tokens: 0 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } },
    { type: 'message_stop' },
  ];
}

function chatWire(): readonly JsonObject[] {
  const chunk = { id: 'chatcmpl_1', object: 'chat.completion.chunk', created: 1, model: 'up' };

  return [
    { ...chunk, choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' } }] },
    { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
  ];
}

function responsesWire(): readonly JsonObject[] {
  const message = {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Hello' }],
  };
  const response = { id: 'resp_1', object: 'response', model: 'upstream-model', output: [message] };

  return [
    { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', role: 'assistant' },
    },
    { type: 'response.output_text.delta', output_index: 0, delta: 'Hello' },
    { type: 'response.output_item.done', output_index: 0, item: message },
    { type: 'response.completed', response: { ...response, status: 'completed' } },
  ];
}

function interactionsWire(): readonly JsonObject[] {
  return [
    { event_type: 'interaction.created', interaction: { id: 'int_1', model: 'upstream-model' } },
    { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [] } },
    { event_type: 'step.delta', index: 0, delta: { type: 'text', text: 'Hello' } },
    { event_type: 'step.stop', index: 0 },
    { event_type: 'interaction.completed', interaction: { id: 'int_1', status: 'completed' } },
  ];
}

function geminiWire(): readonly JsonObject[] {
  return [
    { modelVersion: 'gemini-3.1-pro' },
    {
      candidates: [
        { content: { role: 'model', parts: [{ text: 'Hello' }] }, finishReason: 'STOP' },
      ],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    },
  ];
}

function wireOf(from: ProviderDialect): readonly JsonObject[] {
  if (from === 'anthropic') return anthropicWire();
  if (from === 'chat-completions') return chatWire();
  if (from === 'gemini') return geminiWire();

  return from === 'interactions' ? interactionsWire() : responsesWire();
}

function bodyOf(events: readonly JsonObject[], terminated: boolean): ReadableStream<Uint8Array> {
  const lines = events.map((event) => `data: ${JSON.stringify(event)}\n\n`);
  const body = new Response(`${lines.join('')}${terminated ? 'data: [DONE]\n\n' : ''}`).body;

  if (body === null) throw new Error('the fixture produced no readable body');

  return body;
}

function upstreamBody(from: ProviderDialect): ReadableStream<Uint8Array> {
  return bodyOf(wireOf(from), from === 'chat-completions');
}

function crossingTo(dialect: ProxyDialect, extra: Partial<Crossing> = {}): Crossing {
  return {
    dialect,
    raw: { model: 'virtual-model', stream: true },
    gatewayName: 'gateway one',
    virtualModel: 'virtual-model',
    providerModel: 'provider-model',
    ...extra,
  };
}

async function textOf(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (body === null) throw new Error('the gateway refused to translate the stream');

  return new Response(body).text();
}

function missingMarkers(text: string, markers: readonly string[]): string[] {
  return markers.filter((marker) => !text.includes(marker));
}

describe('a streamed answer crossing from the provider wire to the caller wire', () => {
  it.each(crossings)('should carry a %s answer onto the %s wire', async (from, to) => {
    const text = await textOf(translatedStreamBody(from, crossingTo(to), upstreamBody(from)));

    expect(text).toContain('Hello');
    expect(missingMarkers(text, targetMarkers[to])).toEqual([]);
  });
});

describe('the attribution a crossed stream carries back to the caller', () => {
  it('should name the virtual model on every chat chunk crossed out of Responses', async () => {
    const crossing = crossingTo('chat-completions');
    const text = await textOf(
      translatedStreamBody('responses', crossing, upstreamBody('responses')),
    );

    expect(text).toContain('"model":"virtual-model"');
    expect(text).not.toContain('"model":"upstream-model"');
  });

  it('should name the target model on an Anthropic stream crossed out of Gemini', async () => {
    const crossing = crossingTo('anthropic', {
      geminiToolNames: { lookup: 'lookup' },
      geminiNativeWebSearch: true,
    });
    const text = await textOf(translatedStreamBody('gemini', crossing, upstreamBody('gemini')));

    expect(text).toContain('"model":"provider-model"');
  });

  it('should restore the caller tool names on a Responses stream it was handed', async () => {
    const crossing = crossingTo('responses', {
      responsesToolRefs: { lookup: { kind: 'custom', name: 'lookup' } },
    });
    const text = await textOf(
      translatedStreamBody('anthropic', crossing, upstreamBody('anthropic')),
    );

    expect(text).toContain('"model":"virtual-model"');
    expect(text).toContain('Hello');
  });
});

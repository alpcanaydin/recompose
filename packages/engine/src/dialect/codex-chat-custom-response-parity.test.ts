import { describe, expect, it } from 'vitest';

import type { ChatStreamFrame } from './chat-completions-wire';
import type { ResponsesResponse, ResponsesStreamEvent } from './responses-wire';

import { translateResponse, translateStream } from './dispatcher';

describe('Codex custom tool deltas crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_CustomToolCallStreamDeltas', async () => {
    const frames = await streamed([
      added(0, 'call_apply', 'ApplyPatch'),
      customDelta(0, '*** Begin Patch\n'),
      customDelta(0, '*** End Patch'),
      customDone(0, '*** Begin Patch\n*** End Patch'),
      itemDone(0, 'call_apply', 'ApplyPatch', '*** Begin Patch\n*** End Patch'),
      completed(),
    ]);

    expect(toolParts(frames)).toEqual([
      { index: 0, id: 'call_apply', function: { name: 'ApplyPatch', arguments: '' } },
      { index: 0, function: { arguments: '*** Begin Patch\n' } },
      { index: 0, function: { arguments: '*** End Patch' } },
    ]);
    expect(finishReasons(frames)).toContain('tool_calls');
  });
});

describe('Codex custom output-item fallbacks crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_EmptyCustomToolDeltaUsesDoneFallback', async () => {
    const frames = await streamed([
      added(0, 'call_apply', 'ApplyPatch', 'ctc_1'),
      customDelta(0, '', 'ctc_1'),
      customDone(0, 'full patch', 'ctc_1'),
    ]);

    expect(argumentsOf(frames)).toEqual(['', 'full patch']);
  });
});

describe('Codex custom non-stream responses crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_InterleavedToolCallsKeepStateByItem', async () => {
    const frames = await streamed([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          id: 'fc_1',
          type: 'function_call',
          call_id: 'call_lookup',
          name: 'lookup',
          arguments: '',
        },
      },
      added(1, 'call_apply', 'ApplyPatch', 'ctc_2'),
      {
        type: 'response.function_call_arguments.delta',
        item_id: 'fc_1',
        output_index: 0,
        delta: '{"query":',
      },
      customDelta(1, 'patch', 'ctc_2'),
    ]);

    expect(toolParts(frames).map((part) => part.index)).toEqual([0, 1, 0, 1]);
  });
});

describe('Codex custom tool done fallbacks crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_CustomToolCallInputDoneFallback', async () => {
    const frames = await streamed([
      added(0, 'call_apply', 'ApplyPatch'),
      customDone(0, 'full patch'),
      itemDone(0, 'call_apply', 'ApplyPatch', 'full patch'),
    ]);

    expect(argumentsOf(frames)).toEqual(['', 'full patch']);
  });
});

describe('Codex custom output-item fallbacks crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAI_ToolCallOutputItemDoneFallbacks', async () => {
    const announced = await streamed([
      added(0, 'call_first', 'ApplyPatch'),
      itemDone(0, 'call_first', 'ApplyPatch', 'first patch'),
    ]);
    const unannounced = await streamed([itemDone(0, 'call_apply', 'ApplyPatch', 'full patch')]);
    const fn = await streamed([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'function_call', call_id: 'call_lookup', name: 'lookup', arguments: '' },
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          type: 'function_call',
          call_id: 'call_lookup',
          name: 'lookup',
          arguments: '{"query":"test"}',
        },
      },
    ]);

    expect(argumentsOf(announced)).toEqual(['', 'first patch']);
    expect(toolParts(unannounced)).toEqual([
      { index: 0, id: 'call_apply', function: { name: 'ApplyPatch', arguments: '' } },
      { index: 0, function: { arguments: 'full patch' } },
    ]);
    expect(argumentsOf(fn)).toEqual(['', '{"query":"test"}']);
  });
});

describe('Codex custom non-stream responses crossing Chat', () => {
  it('TestConvertCodexResponseToOpenAINonStream_CustomToolCall', () => {
    const translated = translateResponse('responses', 'chat-completions', customResponse());

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(translated.value).toMatchObject({
      choices: [
        {
          message: {
            tool_calls: [
              { id: 'call_apply', function: { name: 'ApplyPatch', arguments: 'full patch' } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });
  });
});

// Helpers

function added(index: number, callId: string, name: string, id?: string): ResponsesStreamEvent {
  return {
    type: 'response.output_item.added',
    output_index: index,
    item: {
      type: 'custom_tool_call',
      call_id: callId,
      name,
      input: '',
      ...(id === undefined ? {} : { id }),
    },
  };
}

function customDelta(index: number, delta: string, itemId?: string): ResponsesStreamEvent {
  return {
    type: 'response.custom_tool_call_input.delta',
    output_index: index,
    delta,
    ...(itemId === undefined ? {} : { item_id: itemId }),
  };
}

function customDone(index: number, input: string, itemId?: string): ResponsesStreamEvent {
  return {
    type: 'response.custom_tool_call_input.done',
    output_index: index,
    input,
    ...(itemId === undefined ? {} : { item_id: itemId }),
  };
}

function itemDone(
  index: number,
  callId: string,
  name: string,
  input: string,
): ResponsesStreamEvent {
  return {
    type: 'response.output_item.done',
    output_index: index,
    item: { type: 'custom_tool_call', call_id: callId, name, input },
  };
}

function completed(): ResponsesStreamEvent {
  return {
    type: 'response.completed',
    response: {
      id: 'resp_1',
      status: 'completed',
      output: [],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  };
}

async function streamed(events: readonly ResponsesStreamEvent[]): Promise<ChatStreamFrame[]> {
  const result = translateStream('responses', 'chat-completions', streamOf(events));

  if ('outcome' in result) throw new Error('expected stream');
  const frames: ChatStreamFrame[] = [];

  for await (const frame of result.stream) frames.push(frame);

  return frames;
}

function toolParts(frames: readonly ChatStreamFrame[]) {
  return frames.flatMap((frame) =>
    frame.type === 'chunk'
      ? frame.chunk.choices.flatMap((choice) => choice.delta.tool_calls ?? [])
      : [],
  );
}

function argumentsOf(frames: readonly ChatStreamFrame[]) {
  return toolParts(frames).flatMap((part) =>
    part.function?.arguments === undefined ? [] : [part.function.arguments],
  );
}

function finishReasons(frames: readonly ChatStreamFrame[]) {
  return frames.flatMap((frame) =>
    frame.type === 'chunk'
      ? frame.chunk.choices.flatMap((choice) => choice.finish_reason ?? [])
      : [],
  );
}

function customResponse(): ResponsesResponse {
  return {
    id: 'resp_1',
    status: 'completed',
    output: [
      { type: 'custom_tool_call', call_id: 'call_apply', name: 'ApplyPatch', input: 'full patch' },
    ],
  };
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}

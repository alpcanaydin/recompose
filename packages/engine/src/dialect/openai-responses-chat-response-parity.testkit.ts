import type {
  ChatChunkChoice,
  ChatCompletionsResponse,
  ChatStreamFrame,
  ChatToolCall,
} from './chat-completions-wire';
import type { ResponsesToolRef } from './responses-extended-tools';
import type {
  ResponsesKnownStreamEvent,
  ResponsesResponse,
  ResponsesStreamEvent,
} from './responses-wire';

import { translateResponse, translateStream } from './dispatcher';
import { restoreResponsesToolResponse } from './responses-tool-restoration';
import { restoreResponsesToolStream } from './responses-tool-stream-restoration';

export const namespaceRef = {
  mcp__test_mcp__add_numbers: {
    kind: 'namespace',
    namespace: 'mcp__test_mcp__',
    name: 'add_numbers',
  },
} satisfies Readonly<Record<string, ResponsesToolRef>>;
export const collaborationRef = {
  collaboration__send_message: {
    kind: 'namespace',
    namespace: 'collaboration',
    name: 'send_message',
  },
} satisfies Readonly<Record<string, ResponsesToolRef>>;
export const execRef = {
  exec: { kind: 'custom', name: 'exec' },
} satisfies Readonly<Record<string, ResponsesToolRef>>;
export const terminalRef = {
  terminal__exec: { kind: 'custom', name: 'terminal__exec' },
} satisfies Readonly<Record<string, ResponsesToolRef>>;

export type Tool = { index: number; id?: string; name: string; arguments: string };
export type LateTool = { id?: string; name?: string; arguments: string; finish?: boolean };

export function usage(prompt: number, completion: number) {
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  };
}

export function chunk(
  id: string,
  choices: readonly ChatChunkChoice[],
  tokenUsage?: ReturnType<typeof usage>,
): ChatStreamFrame {
  const body = { id, model: 'gpt-5.4', choices };

  return { type: 'chunk', chunk: tokenUsage === undefined ? body : { ...body, usage: tokenUsage } };
}

export function tool(
  index: number,
  id: string | undefined,
  name: string,
  argumentsValue: string,
): Tool {
  return { index, ...(id === undefined ? {} : { id }), name, arguments: argumentsValue };
}

export function toolChoice(choice: number, value: Tool): ChatChunkChoice {
  return {
    index: choice,
    delta: {
      tool_calls: [
        {
          index: value.index,
          ...(value.id === undefined ? {} : { id: value.id }),
          function: { name: value.name, arguments: value.arguments },
        },
      ],
    },
    finish_reason: 'tool_calls',
  };
}

export function lateToolChoice(value: LateTool): ChatChunkChoice {
  return {
    index: 0,
    delta: {
      tool_calls: [
        {
          index: 0,
          ...(value.id === undefined ? {} : { id: value.id }),
          function: {
            ...(value.name === undefined ? {} : { name: value.name }),
            arguments: value.arguments,
          },
        },
      ],
    },
    ...(value.finish === true ? { finish_reason: 'tool_calls' } : {}),
  };
}

export async function toolStream(
  id: string,
  tools: readonly Tool[],
  refs: Readonly<Record<string, ResponsesToolRef>> = {},
) {
  const frames = tools.map((value) => chunk(id, [toolChoice(0, value)]));

  return streamed([...frames, { type: 'done' }], refs);
}

export async function streamed(
  frames: readonly ChatStreamFrame[],
  refs: Readonly<Record<string, ResponsesToolRef>> = {},
) {
  const translated = translateStream('chat-completions', 'responses', streamOf(frames));

  if ('outcome' in translated) throw new Error('expected translated stream');

  const events: ResponsesStreamEvent[] = [];

  for await (const event of restoreResponsesToolStream(translated.stream, refs)) events.push(event);

  return events;
}

export function chatResponse(options: {
  content?: string;
  toolName?: string;
  arguments?: string;
}): ChatCompletionsResponse {
  const calls =
    options.toolName === undefined ? [] : [chatCall(options.toolName, options.arguments)];

  return {
    id: 'chatcmpl_1',
    model: 'model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: options.content ?? null,
          ...(calls.length === 0 ? {} : { tool_calls: calls }),
        },
        finish_reason: calls.length === 0 ? 'stop' : 'tool_calls',
      },
    ],
  };
}

function chatCall(name: string, argumentsValue = '{}'): ChatToolCall {
  return { id: 'call_1', type: 'function', function: { name, arguments: argumentsValue } };
}

export function nonStream(
  body: ChatCompletionsResponse,
  refs: Readonly<Record<string, ResponsesToolRef>> = {},
): ResponsesResponse {
  const translated = translateResponse('chat-completions', 'responses', body);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

  return restoreResponsesToolResponse(translated.value, refs);
}

export function isCompleted(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesKnownStreamEvent, { type: 'response.completed' }> {
  return event.type === 'response.completed' && 'response' in event;
}

function isAdded(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesKnownStreamEvent, { type: 'response.output_item.added' }> {
  return event.type === 'response.output_item.added' && 'item' in event;
}

function isDone(
  event: ResponsesStreamEvent,
): event is Extract<ResponsesKnownStreamEvent, { type: 'response.output_item.done' }> {
  return event.type === 'response.output_item.done' && 'output_index' in event;
}

export function completed(events: readonly ResponsesStreamEvent[]) {
  const event = events.find(isCompleted);

  if (event === undefined) throw new Error('expected completed event');

  return event.response;
}

export function addedItems(events: readonly ResponsesStreamEvent[]) {
  return events.filter(isAdded);
}

export function addedTools(events: readonly ResponsesStreamEvent[]) {
  return addedItems(events).filter((event) => event.item.type === 'function_call');
}

export function doneToolEvents(events: readonly ResponsesStreamEvent[]) {
  return events.filter(
    (
      event,
    ): event is Extract<ResponsesKnownStreamEvent, { type: 'response.output_item.done' }> & {
      item: { type: 'function_call' };
    } => isDone(event) && event.item?.type === 'function_call',
  );
}

export function doneTools(events: readonly ResponsesStreamEvent[]) {
  return doneToolEvents(events).map((event) => event.item);
}

export function toolSummary(item: { call_id?: string; name?: string; arguments?: string }) {
  return { call_id: item.call_id, name: item.name, arguments: item.arguments };
}

export function callId(item: ResponsesResponse['output'][number]) {
  return item.type === 'function_call' ? item.call_id : undefined;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  await Promise.resolve();

  for (const value of values) {
    yield value;
  }
}

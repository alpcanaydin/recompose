import type { HubBlockOpening, HubJsonObject } from './hub';
import type {
  ResponsesOutputItem,
  ResponsesReasoningItem,
  ResponsesStreamEvent,
  ResponsesStreamItem,
} from './responses-wire';

import { responsesReasoningEncryptedContent } from './responses-reasoning-signature';

export type ResponsesOpenBlock = {
  outputIndex: number;
  opening: HubBlockOpening;
  arguments: string;
  content: string;
  annotations: HubJsonObject[];
  signature?: string;
};

function toolArguments(block: ResponsesOpenBlock): string {
  return block.arguments === '' ? '{}' : block.arguments;
}

function toolItem(block: ResponsesOpenBlock): ResponsesStreamItem | undefined {
  if (block.opening.kind !== 'tool') return undefined;

  return {
    type: 'function_call',
    id: `fc_${block.opening.id}`,
    call_id: block.opening.id,
    name: block.opening.name,
    arguments: toolArguments(block),
  };
}

export function completedResponsesOutput(block: ResponsesOpenBlock): ResponsesOutputItem {
  if (block.opening.kind === 'tool') {
    return {
      type: 'function_call',
      id: `fc_${block.opening.id}`,
      call_id: block.opening.id,
      name: block.opening.name,
      arguments: toolArguments(block),
    };
  }

  if (block.opening.kind === 'thinking') return completedThinking(block);

  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: block.content, ...annotationsOf(block) }],
  };
}

function annotationsOf(block: ResponsesOpenBlock) {
  return block.annotations.length === 0 ? {} : { annotations: block.annotations };
}

function completedThinking(block: ResponsesOpenBlock): ResponsesReasoningItem {
  if (block.opening.kind !== 'thinking') throw new Error('expected thinking opening');

  const signature = block.signature ?? block.opening.signature;

  return {
    type: 'reasoning',
    id: `rs_stream_${block.outputIndex}`,
    summary: block.content === '' ? [] : [{ type: 'summary_text', text: block.content }],
    ...responsesReasoningEncryptedContent(
      signature,
      block.opening.carrierDirection,
      block.opening.carrierTarget,
    ),
  };
}

function toolDoneEvents(block: ResponsesOpenBlock): ResponsesStreamEvent[] {
  const item = toolItem(block);

  if (item === undefined) return [];

  return [
    {
      type: 'response.function_call_arguments.done',
      output_index: block.outputIndex,
      item_id: block.opening.kind === 'tool' ? `fc_${block.opening.id}` : undefined,
      arguments: toolArguments(block),
    },
    { type: 'response.output_item.done', output_index: block.outputIndex, item },
  ];
}

function textDoneEvents(block: ResponsesOpenBlock): ResponsesStreamEvent[] {
  if (block.opening.kind !== 'text') return [];

  const id = `msg_stream_${block.outputIndex}`;
  const part = { type: 'output_text' as const, text: block.content, ...annotationsOf(block) };

  return [
    {
      type: 'response.output_text.done',
      output_index: block.outputIndex,
      item_id: id,
      content_index: 0,
      text: block.content,
    },
    {
      type: 'response.content_part.done',
      output_index: block.outputIndex,
      item_id: id,
      content_index: 0,
      part,
    },
    {
      type: 'response.output_item.done',
      output_index: block.outputIndex,
      item: { type: 'message', id, role: 'assistant', content: [part] },
    },
  ];
}

export function responsesDoneEvents(block: ResponsesOpenBlock): ResponsesStreamEvent[] {
  const specific = [...toolDoneEvents(block), ...textDoneEvents(block)];

  return specific.length === 0
    ? [
        {
          type: 'response.output_item.done',
          output_index: block.outputIndex,
          item: completedResponsesOutput(block),
        },
      ]
    : specific;
}

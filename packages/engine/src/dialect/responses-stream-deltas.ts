import type { HubBlockDelta } from './hub';
import type { ResponsesOpenBlock } from './responses-stream-done';
import type { ResponsesStreamEvent } from './responses-wire';

export function responsesDeltaEvents(index: number, delta: HubBlockDelta): ResponsesStreamEvent[] {
  if (delta.kind === 'annotation') return [];

  if (delta.kind === 'text') {
    return [{ type: 'response.output_text.delta', output_index: index, delta: delta.text }];
  }

  if (delta.kind === 'json-args') {
    return [
      {
        type: 'response.function_call_arguments.delta',
        output_index: index,
        delta: delta.partialJson,
      },
    ];
  }

  if (delta.kind === 'thinking') {
    return [
      { type: 'response.reasoning_summary_text.delta', output_index: index, delta: delta.text },
    ];
  }

  return [];
}

export function updateResponsesBlock(block: ResponsesOpenBlock, delta: HubBlockDelta): void {
  if (delta.kind === 'annotation') {
    block.annotations.push(delta.annotation);

    return;
  }

  if (delta.kind === 'json-args') {
    block.arguments += delta.partialJson;

    return;
  }

  if (delta.kind === 'signature') {
    block.signature = delta.signature;

    return;
  }

  block.content += delta.text;
}

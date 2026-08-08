import type { ResponsesKnownStreamEvent } from './responses-wire';

export type ResponsesBlockEvent = Extract<
  ResponsesKnownStreamEvent,
  {
    type:
      | 'response.output_item.added'
      | 'response.output_text.delta'
      | 'response.reasoning_summary_text.delta'
      | 'response.function_call_arguments.delta'
      | 'response.output_item.done';
  }
>;

const blockEventTypes = new Set([
  'response.output_item.added',
  'response.output_text.delta',
  'response.reasoning_summary_text.delta',
  'response.function_call_arguments.delta',
  'response.output_item.done',
]);

export function isResponsesBlockEvent(
  event: ResponsesKnownStreamEvent,
): event is ResponsesBlockEvent {
  return blockEventTypes.has(event.type);
}

import type { AnthropicResponse, AnthropicStreamEvent } from './anthropic-wire';

export function answeredBy(response: AnthropicResponse, model: string): AnthropicResponse {
  return { ...response, model };
}

function namedEvent(event: AnthropicStreamEvent, model: string): AnthropicStreamEvent {
  if (event.type === 'message_start' && 'message' in event) {
    return { ...event, message: answeredBy(event.message, model) };
  }

  return event;
}

export async function* answeringModelInto(
  events: AsyncIterable<AnthropicStreamEvent>,
  model: string,
): AsyncIterable<AnthropicStreamEvent> {
  for await (const event of events) {
    yield namedEvent(event, model);
  }
}

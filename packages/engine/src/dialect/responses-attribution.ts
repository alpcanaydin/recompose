import type { ResponsesResponse, ResponsesStreamEvent } from './responses-wire';

export function responsesAnsweredBy(response: ResponsesResponse, model: string): ResponsesResponse {
  return { ...response, model };
}

function namedEvent(event: ResponsesStreamEvent, model: string): ResponsesStreamEvent {
  if (!('response' in event)) return event;

  return { ...event, response: { ...event.response, model } };
}

export async function* respondingModelInto(
  events: AsyncIterable<ResponsesStreamEvent>,
  model: string,
): AsyncIterable<ResponsesStreamEvent> {
  for await (const event of events) yield namedEvent(event, model);
}

import type { GeminiResponse } from './dialect/gemini-wire';

import { asyncSseBody } from './async-sse-body';

export function geminiSseBodyFrom(
  events: AsyncIterable<GeminiResponse>,
): ReadableStream<Uint8Array> {
  return asyncSseBody(events, (event) => `data: ${JSON.stringify(event)}\n\n`);
}

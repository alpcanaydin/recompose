import type {
  ChatChunkChoice,
  ChatCompletionChunk,
  ChatStreamFrame,
} from './dialect/chat-completions-wire';
import type { JsonObject } from './gateway-wire';

import { asyncSseBody } from './async-sse-body';
import { isJsonObject, parsedJson } from './gateway-wire';

export function withoutTrailingReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

async function* linesFrom(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  try {
    for (;;) {
      const step = await reader.read();

      if (step.done) {
        break;
      }

      buffered += decoder.decode(step.value, { stream: true });

      let newlineAt = buffered.indexOf('\n');

      while (newlineAt >= 0) {
        yield withoutTrailingReturn(buffered.slice(0, newlineAt));
        buffered = buffered.slice(newlineAt + 1);
        newlineAt = buffered.indexOf('\n');
      }
    }

    buffered += decoder.decode();

    if (buffered !== '') {
      yield withoutTrailingReturn(buffered);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

const DATA_PREFIX = 'data:';

export function sseDataOf(line: string): string | null {
  if (!line.startsWith(DATA_PREFIX)) {
    return null;
  }

  const payload = line.slice(DATA_PREFIX.length);

  return payload.startsWith(' ') ? payload.slice(1) : payload;
}

function isChunkChoice(value: unknown): value is ChatChunkChoice {
  return isJsonObject(value) && isJsonObject(value['delta']);
}

function isChunk(value: JsonObject): value is JsonObject & ChatCompletionChunk {
  const choices = value['choices'];

  return Array.isArray(choices) && choices.every(isChunkChoice);
}

function errorFrameOf(value: JsonObject): ChatStreamFrame | null {
  const error = value['error'];

  if (!isJsonObject(error) || typeof error['message'] !== 'string') {
    return null;
  }

  const type = error['type'];

  return {
    type: 'error',
    error: { message: error['message'], ...(typeof type === 'string' ? { type } : {}) },
  };
}

function chatFrameOf(payload: string): ChatStreamFrame {
  if (payload === '[DONE]') {
    return { type: 'done' };
  }

  const parsed = parsedJson(payload);

  if (!isJsonObject(parsed)) {
    return { type: 'unknown' };
  }

  return (
    errorFrameOf(parsed) ??
    (isChunk(parsed) ? { type: 'chunk', chunk: parsed } : { type: 'unknown' })
  );
}

export async function* chatFramesFrom(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<ChatStreamFrame> {
  for await (const line of linesFrom(body)) {
    const payload = sseDataOf(line);

    if (payload !== null) {
      yield chatFrameOf(payload);
    }
  }
}

export async function* jsonEventsFrom(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<JsonObject & { type: string }> {
  for await (const line of linesFrom(body)) {
    const payload = sseDataOf(line);

    if (payload === null || payload === '[DONE]') {
      continue;
    }

    yield jsonEventOf(payload);
  }
}

export async function* jsonObjectsFrom(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<JsonObject> {
  for await (const line of linesFrom(body)) {
    const payload = sseDataOf(line);

    if (payload === null || payload === '[DONE]') {
      continue;
    }

    const parsed = parsedJson(payload);

    if (isJsonObject(parsed)) {
      yield parsed;
    }
  }
}

export async function* interactionEventsFrom(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<JsonObject & { event_type: string }> {
  for await (const value of jsonObjectsFrom(body)) {
    const eventType = value['event_type'];

    if (typeof eventType === 'string') yield { ...value, event_type: eventType };
  }
}

function jsonEventOf(payload: string): JsonObject & { type: string } {
  const parsed = parsedJson(payload);

  if (!isJsonObject(parsed) || typeof parsed['type'] !== 'string') {
    return { type: 'unknown' };
  }

  return { ...parsed, type: parsed['type'] };
}

function chatPayload(frame: ChatStreamFrame): string | null {
  if (frame.type === 'done') {
    return '[DONE]';
  }

  if (frame.type === 'chunk') {
    return JSON.stringify(frame.chunk);
  }

  return frame.type === 'error' ? JSON.stringify({ error: frame.error }) : null;
}

export function chatSseBodyFrom(
  frames: AsyncIterable<ChatStreamFrame>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = frames[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const step = await iterator.next();

          if (step.done === true) {
            controller.close();

            return;
          }

          const payload = chatPayload(step.value);

          if (payload !== null) {
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

            return;
          }
        }
      } catch (failure) {
        controller.error(failure);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}

export function namedSseBodyFrom(
  events: AsyncIterable<{ type: string }>,
): ReadableStream<Uint8Array> {
  return asyncSseBody(
    events,
    (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

export function interactionSseBodyFrom(
  events: AsyncIterable<{ event_type: string }>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const step = await iterator.next();

      if (step.done === true) {
        controller.close();

        return;
      }

      controller.enqueue(
        encoder.encode(`event: ${step.value.event_type}\ndata: ${JSON.stringify(step.value)}\n\n`),
      );
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}

export function transformingSseLines(
  body: ReadableStream<Uint8Array>,
  transformLine: (line: string) => string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = '';

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        const lines = buffered.split('\n');

        buffered = lines.pop() ?? '';

        for (const line of lines) controller.enqueue(encoder.encode(`${transformLine(line)}\n`));
      },
      flush(controller) {
        buffered += decoder.decode();

        if (buffered !== '') controller.enqueue(encoder.encode(transformLine(buffered)));
      },
    }),
  );
}

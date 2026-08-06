import type {
  ChatChunkChoice,
  ChatCompletionChunk,
  ChatStreamFrame,
} from './dialect/chat-completions-wire';
import type { JsonObject } from './gateway-wire';

import { isJsonObject, parsedJson } from './gateway-wire';

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
        yield buffered.slice(0, newlineAt);
        buffered = buffered.slice(newlineAt + 1);
        newlineAt = buffered.indexOf('\n');
      }
    }

    buffered += decoder.decode();

    if (buffered !== '') {
      yield buffered;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

const DATA_PREFIX = 'data:';

function sseDataOf(line: string): string | null {
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

export function sseBodyFrom(events: AsyncIterable<unknown>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const step = await iterator.next();

        if (step.done === true) {
          controller.close();

          return;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(step.value)}\n\n`));
      } catch (failure) {
        controller.error(failure);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}

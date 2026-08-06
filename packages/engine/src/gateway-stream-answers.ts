import type { AnthropicStreamEvent } from './dialect/anthropic-wire';
import type { ResponsesStreamEvent } from './dialect/responses-wire';
import type { Crossing } from './gateway-wire';

import { answeringModelInto } from './dialect/anthropic-attribution';
import { translateStream } from './dialect/dispatcher';
import { chatFramesFrom, chatSseBodyFrom, jsonEventsFrom, namedSseBodyFrom } from './stream-wire';

export function translatedStreamBody(
  from: Crossing['dialect'],
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  if (from === 'chat-completions') {
    return translatedChatStream(crossing, body);
  }

  return from === 'anthropic'
    ? translatedAnthropicStream(crossing, body)
    : translatedResponsesStream(crossing, body);
}

function translatedChatStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  if (crossing.dialect === 'anthropic') {
    const crossed = translateStream('chat-completions', 'anthropic', chatFramesFrom(body));

    return 'outcome' in crossed
      ? null
      : namedSseBodyFrom(answeringModelInto(crossed.stream, crossing.providerModel));
  }

  const crossed = translateStream('chat-completions', 'responses', chatFramesFrom(body));

  return 'outcome' in crossed ? null : namedSseBodyFrom(crossed.stream);
}

function translatedAnthropicStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<AnthropicStreamEvent> = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') {
    const crossed = translateStream('anthropic', 'chat-completions', source);

    return 'outcome' in crossed ? null : chatSseBodyFrom(crossed.stream);
  }

  const crossed = translateStream('anthropic', 'responses', source);

  return 'outcome' in crossed ? null : namedSseBodyFrom(crossed.stream);
}

function translatedResponsesStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<ResponsesStreamEvent> = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') {
    const crossed = translateStream('responses', 'chat-completions', source);

    return 'outcome' in crossed ? null : chatSseBodyFrom(crossed.stream);
  }

  const crossed = translateStream('responses', 'anthropic', source);

  return 'outcome' in crossed
    ? null
    : namedSseBodyFrom(answeringModelInto(crossed.stream, crossing.providerModel));
}

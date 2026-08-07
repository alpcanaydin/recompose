import type { AnthropicStreamEvent } from './dialect/anthropic-wire';
import type { GeminiResponse } from './dialect/gemini-wire';
import type { InteractionsStreamEvent } from './dialect/interactions-wire';
import type { ResponsesStreamEvent } from './dialect/responses-wire';
import type { Crossing, ProviderDialect } from './gateway-wire';

import { answeringModelInto } from './dialect/anthropic-attribution';
import { translateStream } from './dialect/dispatcher';
import { isGeminiResponse, translateStreamFromGemini } from './dialect/gemini-bridge';
import {
  chatFramesFrom,
  chatSseBodyFrom,
  interactionEventsFrom,
  interactionSseBodyFrom,
  jsonEventsFrom,
  jsonObjectsFrom,
  namedSseBodyFrom,
} from './stream-wire';

export function translatedStreamBody(
  from: ProviderDialect,
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  if (from === 'gemini') {
    return translatedGeminiStream(crossing, body);
  }

  if (from === 'chat-completions') {
    return translatedChatStream(crossing, body);
  }

  return from === 'anthropic'
    ? translatedAnthropicStream(crossing, body)
    : from === 'interactions'
      ? translatedInteractionsStream(crossing, body)
      : translatedResponsesStream(crossing, body);
}

async function* geminiResponsesFrom(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<GeminiResponse> {
  for await (const value of jsonObjectsFrom(body)) {
    if (isGeminiResponse(value)) {
      yield value;
    }
  }
}

function translatedGeminiStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  if (crossing.dialect === 'chat-completions') {
    return chatSseBodyFrom(
      translateStreamFromGemini('chat-completions', geminiResponsesFrom(body)),
    );
  }

  if (crossing.dialect === 'anthropic') {
    const crossed = translateStreamFromGemini('anthropic', geminiResponsesFrom(body));

    return namedSseBodyFrom(answeringModelInto(crossed, crossing.providerModel));
  }

  if (crossing.dialect === 'interactions') {
    return interactionSseBodyFrom(
      translateStreamFromGemini('interactions', geminiResponsesFrom(body)),
    );
  }

  return namedSseBodyFrom(translateStreamFromGemini('responses', geminiResponsesFrom(body)));
}

function translatedChatStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  if (crossing.dialect === 'anthropic') return chatToAnthropic(crossing, body);
  if (crossing.dialect === 'interactions') return chatToInteractions(body);

  return chatToResponses(body);
}

function chatToAnthropic(crossing: Crossing, body: ReadableStream<Uint8Array>) {
  const crossed = translateStream('chat-completions', 'anthropic', chatFramesFrom(body));

  return 'outcome' in crossed
    ? null
    : namedSseBodyFrom(answeringModelInto(crossed.stream, crossing.providerModel));
}

function chatToInteractions(body: ReadableStream<Uint8Array>) {
  const crossed = translateStream('chat-completions', 'interactions', chatFramesFrom(body));

  return 'outcome' in crossed ? null : interactionSseBodyFrom(crossed.stream);
}

function chatToResponses(body: ReadableStream<Uint8Array>) {
  const crossed = translateStream('chat-completions', 'responses', chatFramesFrom(body));

  return 'outcome' in crossed ? null : namedSseBodyFrom(crossed.stream);
}

function translatedAnthropicStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<AnthropicStreamEvent> = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') return anthropicToChat(source);
  if (crossing.dialect === 'interactions') return anthropicToInteractions(source);

  return anthropicToResponses(source);
}

function anthropicToChat(source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'chat-completions', source);

  return 'outcome' in crossed ? null : chatSseBodyFrom(crossed.stream);
}

function anthropicToInteractions(source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'interactions', source);

  return 'outcome' in crossed ? null : interactionSseBodyFrom(crossed.stream);
}

function anthropicToResponses(source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'responses', source);

  return 'outcome' in crossed ? null : namedSseBodyFrom(crossed.stream);
}

function translatedResponsesStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<ResponsesStreamEvent> = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') return responsesToChat(source);
  if (crossing.dialect === 'interactions') return responsesToInteractions(source);

  return responsesToAnthropic(crossing, source);
}

function responsesToChat(source: AsyncIterable<ResponsesStreamEvent>) {
  const crossed = translateStream('responses', 'chat-completions', source);

  return 'outcome' in crossed ? null : chatSseBodyFrom(crossed.stream);
}

function responsesToInteractions(source: AsyncIterable<ResponsesStreamEvent>) {
  const crossed = translateStream('responses', 'interactions', source);

  return 'outcome' in crossed ? null : interactionSseBodyFrom(crossed.stream);
}

function responsesToAnthropic(crossing: Crossing, source: AsyncIterable<ResponsesStreamEvent>) {
  const crossed = translateStream('responses', 'anthropic', source);

  return 'outcome' in crossed
    ? null
    : namedSseBodyFrom(answeringModelInto(crossed.stream, crossing.providerModel));
}

function translatedInteractionsStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<InteractionsStreamEvent> = interactionEventsFrom(body);

  if (crossing.dialect === 'chat-completions') return interactionsToChat(source);
  if (crossing.dialect === 'anthropic') return interactionsToAnthropic(crossing, source);

  return interactionsToResponses(source);
}

function interactionsToChat(source: AsyncIterable<InteractionsStreamEvent>) {
  const crossed = translateStream('interactions', 'chat-completions', source);

  return 'outcome' in crossed ? null : chatSseBodyFrom(crossed.stream);
}

function interactionsToAnthropic(
  crossing: Crossing,
  source: AsyncIterable<InteractionsStreamEvent>,
) {
  const crossed = translateStream('interactions', 'anthropic', source);

  return 'outcome' in crossed
    ? null
    : namedSseBodyFrom(answeringModelInto(crossed.stream, crossing.providerModel));
}

function interactionsToResponses(source: AsyncIterable<InteractionsStreamEvent>) {
  const crossed = translateStream('interactions', 'responses', source);

  return 'outcome' in crossed ? null : namedSseBodyFrom(crossed.stream);
}

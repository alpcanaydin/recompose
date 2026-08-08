import type { AnthropicStreamEvent } from './dialect/anthropic-wire';
import type { GeminiResponse } from './dialect/gemini-wire';
import type { InteractionsStreamEvent } from './dialect/interactions-wire';
import type { ResponsesStreamEvent } from './dialect/responses-wire';
import type { Crossing, ProviderDialect } from './gateway-wire';

import { answeringModelInto } from './dialect/anthropic-attribution';
import { translateStream } from './dialect/dispatcher';
import { isGeminiResponse, translateStreamFromGemini } from './dialect/gemini-bridge';
import { respondingModelInto } from './dialect/responses-attribution';
import { restoreResponsesToolStream } from './dialect/responses-tool-stream-restoration';
import { geminiSseBodyFrom } from './gemini-stream-wire';
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
      translateStreamFromGemini(
        'chat-completions',
        geminiResponsesFrom(body),
        crossing.geminiToolNames,
      ),
    );
  }

  if (crossing.dialect === 'anthropic') {
    const crossed = translateStreamFromGemini(
      'anthropic',
      geminiResponsesFrom(body),
      crossing.geminiToolNames,
      { nativeWebSearch: crossing.geminiNativeWebSearch },
    );

    return namedSseBodyFrom(answeringModelInto(crossed, crossing.providerModel));
  }

  if (crossing.dialect === 'interactions') {
    return interactionSseBodyFrom(
      translateStreamFromGemini(
        'interactions',
        geminiResponsesFrom(body),
        crossing.geminiToolNames,
      ),
    );
  }

  return responsesStreamBody(
    crossing,
    translateStreamFromGemini('responses', geminiResponsesFrom(body), crossing.geminiToolNames),
  );
}

function translatedChatStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  if (crossing.dialect === 'anthropic') return chatToAnthropic(crossing, body);
  if (crossing.dialect === 'interactions') return chatToInteractions(body);
  if (crossing.dialect === 'gemini') return chatToGemini(body);

  return chatToResponses(crossing, body);
}

function chatToGemini(body: ReadableStream<Uint8Array>) {
  const crossed = translateStream('chat-completions', 'gemini', chatFramesFrom(body));

  return 'outcome' in crossed ? null : geminiSseBodyFrom(crossed.stream);
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

function chatToResponses(crossing: Crossing, body: ReadableStream<Uint8Array>) {
  const crossed = translateStream('chat-completions', 'responses', chatFramesFrom(body));

  return 'outcome' in crossed ? null : responsesStreamBody(crossing, crossed.stream);
}

function translatedAnthropicStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<AnthropicStreamEvent> = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') return anthropicToChat(source);
  if (crossing.dialect === 'interactions') return anthropicToInteractions(source);
  if (crossing.dialect === 'gemini') return anthropicToGemini(source);

  return anthropicToResponses(crossing, source);
}

function anthropicToGemini(source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'gemini', source);

  return 'outcome' in crossed ? null : geminiSseBodyFrom(crossed.stream);
}

function anthropicToChat(source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'chat-completions', source);

  return 'outcome' in crossed ? null : chatSseBodyFrom(crossed.stream);
}

function anthropicToInteractions(source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'interactions', source);

  return 'outcome' in crossed ? null : interactionSseBodyFrom(crossed.stream);
}

function anthropicToResponses(crossing: Crossing, source: AsyncIterable<AnthropicStreamEvent>) {
  const crossed = translateStream('anthropic', 'responses', source);

  return 'outcome' in crossed ? null : responsesStreamBody(crossing, crossed.stream);
}

function translatedResponsesStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: AsyncIterable<ResponsesStreamEvent> = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') return responsesToChat(crossing, source);
  if (crossing.dialect === 'interactions') return responsesToInteractions(source);
  if (crossing.dialect === 'gemini') return responsesToGemini(source);

  return responsesToAnthropic(crossing, source);
}

function responsesToGemini(source: AsyncIterable<ResponsesStreamEvent>) {
  const crossed = translateStream('responses', 'gemini', source);

  return 'outcome' in crossed ? null : geminiSseBodyFrom(crossed.stream);
}

function responsesToChat(crossing: Crossing, source: AsyncIterable<ResponsesStreamEvent>) {
  const crossed = translateStream('responses', 'chat-completions', source);

  return 'outcome' in crossed
    ? null
    : chatSseBodyFrom(chatModelInto(crossed.stream, crossing.virtualModel));
}

async function* chatModelInto(
  source: AsyncIterable<import('./dialect/chat-completions-wire').ChatStreamFrame>,
  model: string,
) {
  for await (const frame of source) {
    yield frame.type === 'chunk' ? { ...frame, chunk: { ...frame.chunk, model } } : frame;
  }
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
  if (crossing.dialect === 'gemini') return interactionsToGemini(source);

  return interactionsToResponses(crossing, source);
}

function interactionsToGemini(source: AsyncIterable<InteractionsStreamEvent>) {
  const crossed = translateStream('interactions', 'gemini', source);

  return 'outcome' in crossed ? null : geminiSseBodyFrom(crossed.stream);
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

function interactionsToResponses(
  crossing: Crossing,
  source: AsyncIterable<InteractionsStreamEvent>,
) {
  const crossed = translateStream('interactions', 'responses', source);

  return 'outcome' in crossed ? null : responsesStreamBody(crossing, crossed.stream);
}

function responsesStreamBody(
  crossing: Crossing,
  stream: AsyncIterable<ResponsesStreamEvent>,
): ReadableStream<Uint8Array> {
  const restored = restoreResponsesToolStream(stream, crossing.responsesToolRefs ?? {});

  return namedSseBodyFrom(respondingModelInto(restored, crossing.virtualModel));
}

import type { ChatStreamFrame } from './dialect/chat-completions-wire';
import type { Dialect, StreamOf } from './dialect/dispatcher';
import type { GeminiResponse } from './dialect/gemini-wire';
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

type SseEncoder<To extends Dialect> = (stream: StreamOf[To]) => ReadableStream<Uint8Array>;

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

function crossedBody<From extends Dialect, To extends Dialect>(
  from: From,
  to: To,
  source: StreamOf[From],
  encode: SseEncoder<To>,
): ReadableStream<Uint8Array> | null {
  const crossed = translateStream(from, to, source);

  return 'outcome' in crossed ? null : encode(crossed.stream);
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

function anthropicEncoder(crossing: Crossing): SseEncoder<'anthropic'> {
  return (stream) => namedSseBodyFrom(answeringModelInto(stream, crossing.providerModel));
}

function responsesEncoder(crossing: Crossing): SseEncoder<'responses'> {
  return (stream) => responsesStreamBody(crossing, stream);
}

function translatedChatStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: StreamOf['chat-completions'] = chatFramesFrom(body);

  if (crossing.dialect === 'anthropic') {
    return crossedBody('chat-completions', 'anthropic', source, anthropicEncoder(crossing));
  }

  if (crossing.dialect === 'interactions') {
    return crossedBody('chat-completions', 'interactions', source, interactionSseBodyFrom);
  }

  if (crossing.dialect === 'gemini') {
    return crossedBody('chat-completions', 'gemini', source, geminiSseBodyFrom);
  }

  return crossedBody('chat-completions', 'responses', source, responsesEncoder(crossing));
}

function translatedAnthropicStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: StreamOf['anthropic'] = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') {
    return crossedBody('anthropic', 'chat-completions', source, chatSseBodyFrom);
  }

  if (crossing.dialect === 'interactions') {
    return crossedBody('anthropic', 'interactions', source, interactionSseBodyFrom);
  }

  if (crossing.dialect === 'gemini') {
    return crossedBody('anthropic', 'gemini', source, geminiSseBodyFrom);
  }

  return crossedBody('anthropic', 'responses', source, responsesEncoder(crossing));
}

async function* chatModelInto(source: AsyncIterable<ChatStreamFrame>, model: string) {
  for await (const frame of source) {
    yield frame.type === 'chunk' ? { ...frame, chunk: { ...frame.chunk, model } } : frame;
  }
}

function chatEncoderNaming(virtualModel: string): SseEncoder<'chat-completions'> {
  return (stream) => chatSseBodyFrom(chatModelInto(stream, virtualModel));
}

function translatedResponsesStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: StreamOf['responses'] = jsonEventsFrom(body);

  if (crossing.dialect === 'chat-completions') {
    return crossedBody(
      'responses',
      'chat-completions',
      source,
      chatEncoderNaming(crossing.virtualModel),
    );
  }

  if (crossing.dialect === 'interactions') {
    return crossedBody('responses', 'interactions', source, interactionSseBodyFrom);
  }

  if (crossing.dialect === 'gemini') {
    return crossedBody('responses', 'gemini', source, geminiSseBodyFrom);
  }

  return crossedBody('responses', 'anthropic', source, anthropicEncoder(crossing));
}

function translatedInteractionsStream(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> | null {
  const source: StreamOf['interactions'] = interactionEventsFrom(body);

  if (crossing.dialect === 'chat-completions') {
    return crossedBody('interactions', 'chat-completions', source, chatSseBodyFrom);
  }

  if (crossing.dialect === 'anthropic') {
    return crossedBody('interactions', 'anthropic', source, anthropicEncoder(crossing));
  }

  if (crossing.dialect === 'gemini') {
    return crossedBody('interactions', 'gemini', source, geminiSseBodyFrom);
  }

  return crossedBody('interactions', 'responses', source, responsesEncoder(crossing));
}

function responsesStreamBody(
  crossing: Crossing,
  stream: AsyncIterable<ResponsesStreamEvent>,
): ReadableStream<Uint8Array> {
  const restored = restoreResponsesToolStream(stream, crossing.responsesToolRefs ?? {});

  return namedSseBodyFrom(respondingModelInto(restored, crossing.virtualModel));
}

import type { Dialect, TranslationRefusal } from '../refusals';
import type { AnthropicRequest, AnthropicResponse, AnthropicStreamEvent } from './anthropic-wire';
import type {
  ChatCompletionsRequest,
  ChatCompletionsResponse,
  ChatStreamFrame,
} from './chat-completions-wire';
import type { TranslateResult } from './fates';
import type { GeminiRequest, GeminiResponse } from './gemini-wire';
import type { HubRequest, HubResponse, HubStreamEvent } from './hub';
import type {
  InteractionsRequest,
  InteractionsResponse,
  InteractionsStreamEvent,
} from './interactions-wire';
import type { ResponsesRequest, ResponsesResponse, ResponsesStreamEvent } from './responses-wire';

import {
  decodeRequest as anthropicDecodeRequest,
  decodeResponse as anthropicDecodeResponse,
  decodeStream as anthropicDecodeStream,
  encodeRequest as anthropicEncodeRequest,
  encodeResponse as anthropicEncodeResponse,
  encodeStream as anthropicEncodeStream,
} from './anthropic-codec';
import { anthropicRequestForResponses } from './anthropic-responses-request';
import {
  decodeRequest as chatDecodeRequest,
  decodeResponse as chatDecodeResponse,
  decodeStream as chatDecodeStream,
  encodeRequest as chatEncodeRequest,
  encodeResponse as chatEncodeResponse,
  encodeStream as chatEncodeStream,
} from './chat-completions-codec';
import { normalizeChatHistoryForResponses } from './chat-completions-responses-history';
import { decodeStreamForResponses as chatDecodeStreamForResponses } from './chat-completions-stream-decode';
import {
  decodeRequest as geminiDecodeRequest,
  decodeResponse as geminiDecodeResponse,
  decodeStream as geminiDecodeStream,
  encodeRequest as geminiEncodeRequest,
  encodeResponse as geminiEncodeResponse,
  encodeStream as geminiEncodeStream,
} from './gemini-codec';
import {
  decodeRequest as interactionsDecodeRequest,
  decodeResponse as interactionsDecodeResponse,
  decodeStream as interactionsDecodeStream,
  encodeRequest as interactionsEncodeRequest,
  encodeResponse as interactionsEncodeResponse,
  encodeStream as interactionsEncodeStream,
} from './interactions-codec';
import { responsesStreamForChat } from './responses-chat-custom-stream';
import {
  decodeRequest as responsesDecodeRequest,
  decodeResponse as responsesDecodeResponse,
  decodeStream as responsesDecodeStream,
  encodeRequest as responsesEncodeRequest,
  encodeResponse as responsesEncodeResponse,
  encodeStream as responsesEncodeStream,
} from './responses-codec';
import { decodeRequestForChat as responsesDecodeRequestForChat } from './responses-request';
import { requestHubForTarget } from './target-request-hub';
import { targetStreamEvents } from './target-stream-events';

export type { Dialect } from '../refusals';

export type RequestOf = {
  anthropic: AnthropicRequest;
  'chat-completions': ChatCompletionsRequest;
  gemini: GeminiRequest;
  interactions: InteractionsRequest;
  responses: ResponsesRequest;
};

export type ResponseOf = {
  anthropic: AnthropicResponse;
  'chat-completions': ChatCompletionsResponse;
  gemini: GeminiResponse;
  interactions: InteractionsResponse;
  responses: ResponsesResponse;
};

export type StreamOf = {
  anthropic: AsyncIterable<AnthropicStreamEvent>;
  'chat-completions': AsyncIterable<ChatStreamFrame>;
  gemini: AsyncIterable<GeminiResponse>;
  interactions: AsyncIterable<InteractionsStreamEvent>;
  responses: AsyncIterable<ResponsesStreamEvent>;
};

type Passthrough = { outcome: 'passthrough' };
export type RequestTranslation<To extends Dialect> =
  | Passthrough
  | TranslateResult<RequestOf[To], TranslationRefusal>;
export type ResponseTranslation<To extends Dialect> =
  | Passthrough
  | TranslateResult<ResponseOf[To], TranslationRefusal>;

export type StreamTranslation<To extends Dialect> = Passthrough | { stream: StreamOf[To] };

type RequestDecoders = {
  [D in Dialect]: (body: RequestOf[D]) => TranslateResult<HubRequest, TranslationRefusal>;
};

type RequestEncoders = {
  [D in Dialect]: (hub: HubRequest) => TranslateResult<RequestOf[D], TranslationRefusal>;
};

type ResponseDecoders = {
  [D in Dialect]: (body: ResponseOf[D]) => TranslateResult<HubResponse, TranslationRefusal>;
};

type ResponseEncoders = {
  [D in Dialect]: (hub: HubResponse) => TranslateResult<ResponseOf[D], TranslationRefusal>;
};

type StreamDecoders = {
  [D in Dialect]: (source: StreamOf[D]) => AsyncIterable<HubStreamEvent>;
};

type StreamEncoders = {
  [D in Dialect]: (events: AsyncIterable<HubStreamEvent>) => StreamOf[D];
};

const requestDecoders: RequestDecoders = {
  anthropic: anthropicDecodeRequest,
  'chat-completions': chatDecodeRequest,
  gemini: geminiDecodeRequest,
  interactions: interactionsDecodeRequest,
  responses: responsesDecodeRequest,
};

const responsesTargetRequestDecoders: RequestDecoders = {
  ...requestDecoders,
  'chat-completions': (body) => chatDecodeRequest(normalizeChatHistoryForResponses(body)),
};

const chatTargetRequestDecoders: RequestDecoders = {
  ...requestDecoders,
  responses: responsesDecodeRequestForChat,
};

const requestEncoders: RequestEncoders = {
  anthropic: anthropicEncodeRequest,
  'chat-completions': chatEncodeRequest,
  gemini: geminiEncodeRequest,
  interactions: interactionsEncodeRequest,
  responses: responsesEncodeRequest,
};

const responseDecoders: ResponseDecoders = {
  anthropic: anthropicDecodeResponse,
  'chat-completions': chatDecodeResponse,
  gemini: geminiDecodeResponse,
  interactions: interactionsDecodeResponse,
  responses: responsesDecodeResponse,
};

const responseEncoders: ResponseEncoders = {
  anthropic: anthropicEncodeResponse,
  'chat-completions': chatEncodeResponse,
  gemini: geminiEncodeResponse,
  interactions: interactionsEncodeResponse,
  responses: responsesEncodeResponse,
};

const streamDecoders: StreamDecoders = {
  anthropic: anthropicDecodeStream,
  'chat-completions': chatDecodeStream,
  gemini: geminiDecodeStream,
  interactions: interactionsDecodeStream,
  responses: responsesDecodeStream,
};

const responsesTargetStreamDecoders: StreamDecoders = {
  ...streamDecoders,
  'chat-completions': chatDecodeStreamForResponses,
};

const chatTargetStreamDecoders: StreamDecoders = {
  ...streamDecoders,
  responses: decodeResponsesStreamForChat,
};

const targetedStreamDecoders: Partial<Record<Dialect, StreamDecoders>> = {
  responses: responsesTargetStreamDecoders,
  'chat-completions': chatTargetStreamDecoders,
};

function decodeResponsesStreamForChat(
  source: StreamOf['responses'],
): AsyncIterable<HubStreamEvent> {
  return responsesDecodeStream(responsesStreamForChat(source));
}

const streamEncoders: StreamEncoders = {
  anthropic: anthropicEncodeStream,
  'chat-completions': chatEncodeStream,
  gemini: geminiEncodeStream,
  interactions: interactionsEncodeStream,
  responses: responsesEncodeStream,
};

function sameDialect(from: Dialect, to: Dialect): boolean {
  return from === to;
}

function composeThroughHub<Hub, Out>(
  decoded: TranslateResult<Hub, TranslationRefusal>,
  encode: (hub: Hub) => TranslateResult<Out, TranslationRefusal>,
): TranslateResult<Out, TranslationRefusal> {
  if ('refusal' in decoded) {
    return decoded;
  }

  const encoded = encode(decoded.value);

  if ('refusal' in encoded) {
    return encoded;
  }

  return { value: encoded.value, fates: [...decoded.fates, ...encoded.fates] };
}

export function translateRequest<From extends Dialect, To extends Dialect>(
  from: From,
  to: To,
  body: RequestOf[From],
): RequestTranslation<To> {
  if (sameDialect(from, to)) {
    return { outcome: 'passthrough' };
  }

  const decoders = requestDecodersFor(to);
  const decode: (body: RequestOf[From]) => TranslateResult<HubRequest, TranslationRefusal> =
    decoders[from];
  const encode: (hub: HubRequest) => TranslateResult<RequestOf[To], TranslationRefusal> =
    requestEncoders[to];

  const targeted = requestHubForTarget(from, to, decode(body));
  const contextual =
    from === 'anthropic' && to === 'responses'
      ? anthropicRequestForResponses(targeted, requestModel(body))
      : targeted;

  return composeThroughHub(contextual, encode);
}

function requestDecodersFor(to: Dialect): RequestDecoders {
  if (to === 'chat-completions') return chatTargetRequestDecoders;
  if (to === 'responses') return responsesTargetRequestDecoders;

  return requestDecoders;
}

function requestModel(body: RequestOf[Dialect]): string | undefined {
  return typeof body.model === 'string' ? body.model : undefined;
}

export function translateResponse<From extends Dialect, To extends Dialect>(
  from: From,
  to: To,
  body: ResponseOf[From],
): ResponseTranslation<To> {
  if (sameDialect(from, to)) {
    return { outcome: 'passthrough' };
  }

  const decode: (body: ResponseOf[From]) => TranslateResult<HubResponse, TranslationRefusal> =
    responseDecoders[from];
  const encode: (hub: HubResponse) => TranslateResult<ResponseOf[To], TranslationRefusal> =
    responseEncoders[to];

  return composeThroughHub(decode(body), encode);
}

export function translateStream<From extends Dialect, To extends Dialect>(
  from: From,
  to: To,
  stream: StreamOf[From],
): StreamTranslation<To> {
  if (sameDialect(from, to)) {
    return { outcome: 'passthrough' };
  }

  const decoders = targetedStreamDecoders[to] ?? streamDecoders;
  const decode: (source: StreamOf[From]) => AsyncIterable<HubStreamEvent> = decoders[from];
  const encode: (events: AsyncIterable<HubStreamEvent>) => StreamOf[To] = streamEncoders[to];
  const decoded = decode(stream);

  return {
    stream: encode(targetStreamEvents(from, to, decoded)),
  };
}

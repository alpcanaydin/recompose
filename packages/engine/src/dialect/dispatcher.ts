import type { Dialect, TranslationRefusal } from '../refusals';
import type {
  ChatCompletionsRequest,
  ChatCompletionsResponse,
  ChatStreamFrame,
} from './chat-completions-wire';
import type { TranslateResult, Translated } from './fates';
import type { HubRequest, HubResponse, HubStreamEvent } from './hub';
import type { ResponsesRequest, ResponsesResponse, ResponsesStreamEvent } from './responses-wire';

import {
  decodeRequest as chatDecodeRequest,
  decodeResponse as chatDecodeResponse,
  decodeStream as chatDecodeStream,
  encodeRequest as chatEncodeRequest,
  encodeResponse as chatEncodeResponse,
  encodeStream as chatEncodeStream,
} from './chat-completions-codec';
import {
  decodeRequest as responsesDecodeRequest,
  decodeResponse as responsesDecodeResponse,
  decodeStream as responsesDecodeStream,
  encodeRequest as responsesEncodeRequest,
  encodeResponse as responsesEncodeResponse,
  encodeStream as responsesEncodeStream,
} from './responses-codec';

export type { Dialect } from '../refusals';

export type RequestOf = {
  anthropic: HubRequest;
  'chat-completions': ChatCompletionsRequest;
  responses: ResponsesRequest;
};

export type ResponseOf = {
  anthropic: HubResponse;
  'chat-completions': ChatCompletionsResponse;
  responses: ResponsesResponse;
};

export type StreamOf = {
  anthropic: AsyncIterable<HubStreamEvent>;
  'chat-completions': AsyncIterable<ChatStreamFrame>;
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

const identityRequest = (body: HubRequest): Translated<HubRequest> => ({ value: body, fates: [] });

const identityResponse = (body: HubResponse): Translated<HubResponse> => ({
  value: body,
  fates: [],
});

const identityStream = (source: AsyncIterable<HubStreamEvent>): AsyncIterable<HubStreamEvent> =>
  source;

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
  anthropic: identityRequest,
  'chat-completions': chatDecodeRequest,
  responses: responsesDecodeRequest,
};

const requestEncoders: RequestEncoders = {
  anthropic: identityRequest,
  'chat-completions': chatEncodeRequest,
  responses: responsesEncodeRequest,
};

const responseDecoders: ResponseDecoders = {
  anthropic: identityResponse,
  'chat-completions': chatDecodeResponse,
  responses: responsesDecodeResponse,
};

const responseEncoders: ResponseEncoders = {
  anthropic: identityResponse,
  'chat-completions': chatEncodeResponse,
  responses: responsesEncodeResponse,
};

const streamDecoders: StreamDecoders = {
  anthropic: identityStream,
  'chat-completions': chatDecodeStream,
  responses: responsesDecodeStream,
};

const streamEncoders: StreamEncoders = {
  anthropic: identityStream,
  'chat-completions': chatEncodeStream,
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

  const decode: (body: RequestOf[From]) => TranslateResult<HubRequest, TranslationRefusal> =
    requestDecoders[from];
  const encode: (hub: HubRequest) => TranslateResult<RequestOf[To], TranslationRefusal> =
    requestEncoders[to];

  return composeThroughHub(decode(body), encode);
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

  const decode: (source: StreamOf[From]) => AsyncIterable<HubStreamEvent> = streamDecoders[from];
  const encode: (events: AsyncIterable<HubStreamEvent>) => StreamOf[To] = streamEncoders[to];

  return { stream: encode(decode(stream)) };
}

import type { ProxyDialect } from '../gateway-wire';
import type { TranslationRefusal } from '../refusals';
import type { RequestOf, ResponseOf, StreamOf } from './dispatcher';
import type { TranslateResult } from './fates';
import type { GeminiRequest, GeminiResponse } from './gemini-wire';
import type { HubRequest, HubResponse, HubStreamEvent } from './hub';

import { encodeStream as encodeAnthropicStream } from './anthropic-codec';
import { decodeRequest as decodeAnthropic } from './anthropic-request';
import { encodeResponse as encodeAnthropic } from './anthropic-response';
import { encodeStream as encodeChatStream } from './chat-completions-codec';
import { decodeRequest as decodeChat } from './chat-completions-request';
import { encodeResponse as encodeChat } from './chat-completions-response';
import { encodeRequest as encodeGemini } from './gemini-request';
import { decodeResponse as decodeGemini } from './gemini-response';
import { decodeStream as decodeGeminiStream } from './gemini-stream';
import { encodeStream as encodeResponsesStream } from './responses-codec';
import { decodeRequest as decodeResponses } from './responses-request';
import { encodeResponse as encodeResponses } from './responses-response';

type RequestDecoders = {
  [D in ProxyDialect]: (body: RequestOf[D]) => TranslateResult<HubRequest, TranslationRefusal>;
};

type ResponseEncoders = {
  [D in ProxyDialect]: (body: HubResponse) => TranslateResult<ResponseOf[D], TranslationRefusal>;
};

type StreamEncoders = {
  [D in ProxyDialect]: (events: AsyncIterable<HubStreamEvent>) => StreamOf[D];
};

const requestDecoders: RequestDecoders = {
  anthropic: decodeAnthropic,
  'chat-completions': decodeChat,
  responses: decodeResponses,
};

const responseEncoders: ResponseEncoders = {
  anthropic: encodeAnthropic,
  'chat-completions': encodeChat,
  responses: encodeResponses,
};

const streamEncoders: StreamEncoders = {
  anthropic: encodeAnthropicStream,
  'chat-completions': encodeChatStream,
  responses: encodeResponsesStream,
};

export function translateRequestToGemini<From extends ProxyDialect>(
  from: From,
  body: RequestOf[From],
): TranslateResult<GeminiRequest, TranslationRefusal> {
  const decode: (value: RequestOf[From]) => TranslateResult<HubRequest, TranslationRefusal> =
    requestDecoders[from];
  const decoded = decode(body);

  if ('refusal' in decoded) {
    return decoded;
  }

  const encoded = encodeGemini(decoded.value);

  return { value: encoded.value, fates: [...decoded.fates, ...encoded.fates] };
}

export function translateResponseFromGemini<To extends ProxyDialect>(
  to: To,
  body: GeminiResponse,
): TranslateResult<ResponseOf[To], TranslationRefusal> {
  const decoded = decodeGemini(body, to === 'anthropic');
  const encode: (value: HubResponse) => TranslateResult<ResponseOf[To], TranslationRefusal> =
    responseEncoders[to];
  const encoded = encode(decoded.value);

  if ('refusal' in encoded) {
    return encoded;
  }

  return { value: encoded.value, fates: [...decoded.fates, ...encoded.fates] };
}

export function isGeminiResponse(value: Record<string, unknown>): value is GeminiResponse {
  return Array.isArray(value['candidates']) || typeof value['usageMetadata'] === 'object';
}

export function translateStreamFromGemini<To extends ProxyDialect>(
  to: To,
  source: AsyncIterable<GeminiResponse>,
): StreamOf[To] {
  const encode: (events: ReturnType<typeof decodeGeminiStream>) => StreamOf[To] =
    streamEncoders[to];

  return encode(decodeGeminiStream(source, to === 'anthropic'));
}

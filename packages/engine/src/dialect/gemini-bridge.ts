import type { ProxyDialect } from '../gateway-wire';
import type { TranslationRefusal } from '../refusals';
import type { ChatCompletionsResponse } from './chat-completions-wire';
import type { RequestOf, ResponseOf, StreamOf } from './dispatcher';
import type { TranslateResult } from './fates';
import type { GeminiRequest, GeminiResponse } from './gemini-wire';
import type { HubRequest, HubResponse, HubStreamEvent } from './hub';

import { encodeStream as encodeAnthropicStream } from './anthropic-codec';
import { decodeRequest as decodeAnthropic } from './anthropic-request';
import { encodeResponse as encodeAnthropic } from './anthropic-response';
import { encodeStream as encodeChatStream } from './chat-completions-codec';
import { decodeRequestWithCompat as decodeChatWithCompat } from './chat-completions-request-decode';
import { encodeResponse as encodeChat } from './chat-completions-response';
import { geminiClaudeCarrierResponse } from './gemini-claude-carrier-content';
import { geminiClaudeCarrierStream } from './gemini-claude-carrier-stream';
import { orderClaudeContentForGemini } from './gemini-claude-content-order';
import { mergeGeminiThinkingSignature } from './gemini-claude-stream';
import { backfillGeminiFunctionResponseNames } from './gemini-native-request';
import { encodeRequest as encodeGemini } from './gemini-request';
import { decodeRequest as decodeGeminiRequest } from './gemini-request-decode';
import { decodeResponse as decodeGemini } from './gemini-response';
import { encodeResponse as encodeGeminiResponse } from './gemini-response-encode';
import { normalizeGeminiResponsesTextStream } from './gemini-responses-signature-stream';
import { normalizeGeminiResponsesTextResponse } from './gemini-responses-text-signatures';
import { decodeStream as decodeGeminiStream } from './gemini-stream';
import { encodeStream as encodeGeminiStream } from './gemini-stream-encode';
import {
  restoreGeminiResponseNames,
  restoreGeminiStreamName,
  reverseGeminiToolNames,
} from './gemini-tool-names';
import {
  normalizeGeminiWebSearchResponse,
  normalizeGeminiWebSearchStream,
} from './gemini-web-search-grounding';
import {
  decodeRequest as decodeInteractions,
  encodeResponse as encodeInteractions,
  encodeStream as encodeInteractionsStream,
} from './interactions-codec';
import { encodeStream as encodeResponsesStream } from './responses-codec';
import { responsesRequestForGemini } from './responses-gemini-request';
import { decodeRequest as decodeResponses } from './responses-request';
import { encodeResponse as encodeResponses } from './responses-response';

type BridgeDialect = ProxyDialect;

type RequestDecoders = {
  [D in BridgeDialect]: (body: RequestOf[D]) => TranslateResult<HubRequest, TranslationRefusal>;
};

type ResponseEncoders = {
  [D in BridgeDialect]: (body: HubResponse) => TranslateResult<ResponseOf[D], TranslationRefusal>;
};

type StreamEncoders = {
  [D in BridgeDialect]: (events: AsyncIterable<HubStreamEvent>) => StreamOf[D];
};

const requestDecoders: RequestDecoders = {
  anthropic: decodeAnthropic,
  'chat-completions': decodeChatWithCompat,
  gemini: (body) => decodeGeminiRequest(backfillGeminiFunctionResponseNames(body)),
  interactions: decodeInteractions,
  responses: (body) => decodeResponses(responsesRequestForGemini(body), false, true),
};

const compatibleRequestDecoders: RequestDecoders = {
  ...requestDecoders,
  responses: (body) => decodeResponses(responsesRequestForGemini(body), true, true),
};

type GeminiRequestOptions = { preserveIncompatibleReasoning?: boolean };
type GeminiResponseOptions = { nativeWebSearch?: boolean | undefined };

const responseEncoders: ResponseEncoders = {
  anthropic: encodeAnthropic,
  'chat-completions': encodeChatWithReasoning,
  gemini: encodeGeminiResponse,
  interactions: encodeInteractions,
  responses: encodeResponses,
};

function encodeChatWithReasoning(
  hub: HubResponse,
): TranslateResult<ChatCompletionsResponse, TranslationRefusal> {
  const encoded = encodeChat(hub);

  if ('refusal' in encoded) return encoded;

  const reasoning = hub.content
    .flatMap((block) => (block.type === 'thinking' ? [block.text] : []))
    .join('');
  const choice = encoded.value.choices[0];

  if (reasoning === '' || choice === undefined) return encoded;

  return {
    value: {
      ...encoded.value,
      choices: [
        {
          ...choice,
          message: { ...choice.message, reasoning_content: reasoning },
        },
        ...encoded.value.choices.slice(1),
      ],
    },
    fates: encoded.fates,
  };
}

const streamEncoders: StreamEncoders = {
  anthropic: encodeAnthropicStream,
  'chat-completions': encodeChatStream,
  gemini: encodeGeminiStream,
  interactions: encodeInteractionsStream,
  responses: encodeResponsesStream,
};

export function translateRequestToGemini<From extends BridgeDialect>(
  from: From,
  body: RequestOf[From],
  noteNames?: (names: Readonly<Record<string, string>>) => void,
  options: GeminiRequestOptions = {},
): TranslateResult<GeminiRequest, TranslationRefusal> {
  const decoded = decodedRequest(from, body, options);

  if ('refusal' in decoded) {
    return decoded;
  }

  const hub = hubForGemini(from, decoded.value);

  noteNames?.(reverseGeminiToolNames(hub));

  const encoded = encodeGemini(hub);

  return { value: encoded.value, fates: [...decoded.fates, ...encoded.fates] };
}

function decodedRequest<From extends BridgeDialect>(
  from: From,
  body: RequestOf[From],
  options: GeminiRequestOptions,
): TranslateResult<HubRequest, TranslationRefusal> {
  const decoders =
    options.preserveIncompatibleReasoning === true ? compatibleRequestDecoders : requestDecoders;
  const decode: (value: RequestOf[From]) => TranslateResult<HubRequest, TranslationRefusal> =
    decoders[from];

  return decode(body);
}

function hubForGemini(from: BridgeDialect, request: HubRequest): HubRequest {
  if (from === 'anthropic') return orderClaudeContentForGemini(request);

  return from === 'chat-completions' ? withoutTrailingAssistant(request) : request;
}

function withoutTrailingAssistant(request: HubRequest): HubRequest {
  const last = request.messages.at(-1);

  if (last?.role !== 'assistant') return request;
  if (last.content.some((block) => block.type === 'tool_use')) return request;

  return { ...request, messages: request.messages.slice(0, -1) };
}

export function translateResponseFromGemini<To extends BridgeDialect>(
  to: To,
  body: GeminiResponse,
  names: Readonly<Record<string, string>> = {},
  options: GeminiResponseOptions = {},
): TranslateResult<ResponseOf[To], TranslationRefusal> {
  const source = responseSource(body, to, options);
  const decoded = decodeGemini(
    source,
    to === 'anthropic',
    to === 'responses' || to === 'anthropic',
  );
  const encode: (value: HubResponse) => TranslateResult<ResponseOf[To], TranslationRefusal> =
    responseEncoders[to];
  const restored = restoreGeminiResponseNames(decoded.value, names);
  const carried = carriedResponse(to, restored);
  const encoded = encode(carried);

  if ('refusal' in encoded) {
    return encoded;
  }

  return { value: encoded.value, fates: [...decoded.fates, ...encoded.fates] };
}

function responseSource(
  body: GeminiResponse,
  to: BridgeDialect,
  options: GeminiResponseOptions,
): GeminiResponse {
  const grounded = normalizeGeminiWebSearchResponse(body, options.nativeWebSearch === true);

  return to === 'responses' ? normalizeGeminiResponsesTextResponse(grounded) : grounded;
}

function carriedResponse(to: BridgeDialect, response: HubResponse): HubResponse {
  return to === 'anthropic' ? geminiClaudeCarrierResponse(response) : response;
}

export function isGeminiResponse(value: Record<string, unknown>): value is GeminiResponse {
  return (
    Array.isArray(value['candidates']) ||
    typeof value['usageMetadata'] === 'object' ||
    typeof value['usage_metadata'] === 'object'
  );
}

export function translateStreamFromGemini<To extends BridgeDialect>(
  to: To,
  source: AsyncIterable<GeminiResponse>,
  names: Readonly<Record<string, string>> = {},
  options: GeminiResponseOptions = {},
): StreamOf[To] {
  const encode: (events: ReturnType<typeof decodeGeminiStream>) => StreamOf[To] =
    streamEncoders[to];
  const normalized = normalizedGeminiStream(to, source, options);
  const decoded = restoredStream(
    decodeGeminiStream(normalized, to === 'anthropic', to === 'responses' || to === 'anthropic'),
    names,
  );
  const carried = carrierStream(to, decoded);

  return encode(finalGeminiStream(to, carried));
}

function normalizedGeminiStream(
  to: BridgeDialect,
  source: AsyncIterable<GeminiResponse>,
  options: GeminiResponseOptions,
): AsyncIterable<GeminiResponse> {
  const grounded = normalizeGeminiWebSearchStream(source, options.nativeWebSearch === true);

  return to === 'responses' ? normalizeGeminiResponsesTextStream(grounded) : grounded;
}

function carrierStream(
  to: BridgeDialect,
  decoded: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  return to === 'anthropic' ? geminiClaudeCarrierStream(decoded) : decoded;
}

function finalGeminiStream(
  to: BridgeDialect,
  carried: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  return to === 'anthropic' ? mergeGeminiThinkingSignature(carried) : carried;
}

async function* restoredStream(
  source: AsyncIterable<HubStreamEvent>,
  names: Readonly<Record<string, string>>,
): AsyncIterable<HubStreamEvent> {
  for await (const event of source) yield restoreGeminiStreamName(event, names);
}

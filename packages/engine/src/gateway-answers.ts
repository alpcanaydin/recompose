import type { AnthropicResponse } from './dialect/anthropic-wire';
import type { ChatCompletionsResponse } from './dialect/chat-completions-wire';
import type { ResponsesResponse } from './dialect/responses-wire';
import type { Crossing, JsonObject } from './gateway-wire';
import type { AnthropicRefusal } from './refusals';

import { answeredBy } from './dialect/anthropic-attribution';
import { translateResponse } from './dialect/dispatcher';
import { translatedStreamBody } from './gateway-stream-answers';
import {
  isJsonObject,
  jsonResponse,
  parsedJson,
  refusalResponse,
  wantsStream,
} from './gateway-wire';
import { jsonEventsFrom } from './stream-wire';

function attributionOf(crossing: Crossing): Record<string, string> {
  return {
    'x-recompose-virtual-model': crossing.virtualModel,
    'x-recompose-target': crossing.providerModel,
  };
}

export function unreachableTargetMessage(crossing: Crossing): string {
  return `The gateway "${crossing.gatewayName}" could not reach the target for the virtual model "${crossing.virtualModel}".`;
}

function unreachableTargetBody(crossing: Crossing): unknown {
  if (crossing.dialect === 'anthropic') {
    const body: AnthropicRefusal = {
      type: 'error',
      error: { type: 'api_error', message: unreachableTargetMessage(crossing) },
    };

    return body;
  }

  return {
    error: {
      message: unreachableTargetMessage(crossing),
      type: 'api_error',
      param: null,
      code: 'target_unreachable',
    },
  };
}

export function unreachableTargetAnswer(crossing: Crossing): Response {
  return jsonResponse(unreachableTargetBody(crossing), 502, attributionOf(crossing));
}

function upstreamHeaders(upstream: Response, attribution: Record<string, string>): Headers {
  const headers = new Headers(attribution);
  const contentType = upstream.headers.get('content-type');

  if (contentType !== null) {
    headers.set('content-type', contentType);
  }

  return headers;
}

function passedAlong(upstream: Response, attribution: Record<string, string>): Response {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstreamHeaders(upstream, attribution),
  });
}

export async function answerFrom(
  crossing: Crossing,
  upstream: Response,
  upstreamDialect: Crossing['dialect'] = 'chat-completions',
): Promise<Response> {
  const attribution = attributionOf(crossing);

  if (!upstream.ok) {
    return passedAlong(upstream, attribution);
  }

  if (upstream.headers.get('content-type')?.includes('text/event-stream') === true) {
    return streamedAnswer(crossing, upstream, attribution, upstreamDialect);
  }

  return translatedAnswer(crossing, upstream, attribution, upstreamDialect);
}

async function streamedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
  upstreamDialect: Crossing['dialect'],
): Promise<Response> {
  if (needsCompletedResponses(upstreamDialect, crossing)) {
    return completedResponsesAnswer(crossing, upstream, attribution);
  }

  if (crossing.dialect === upstreamDialect) {
    return passedAlong(upstream, attribution);
  }

  const body = upstream.body;

  if (body === null) {
    return passedAlong(upstream, attribution);
  }

  const crossed = translatedStreamBody(upstreamDialect, crossing, body);

  if (crossed === null) {
    return passedAlong(upstream, attribution);
  }

  return new Response(crossed, {
    status: upstream.status,
    headers: { ...attribution, 'content-type': 'text/event-stream' },
  });
}

function needsCompletedResponses(
  upstreamDialect: Crossing['dialect'],
  crossing: Crossing,
): boolean {
  return upstreamDialect === 'responses' && !wantsStream(crossing.raw);
}

function isChatAnswer(value: JsonObject): value is JsonObject & ChatCompletionsResponse {
  const choices = value['choices'];

  return (
    Array.isArray(choices) &&
    choices.every((choice) => isJsonObject(choice) && isJsonObject(choice['message']))
  );
}

function textAnswer(
  text: string,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  return new Response(text, {
    status: upstream.status,
    headers: upstreamHeaders(upstream, attribution),
  });
}

function chatAnswerOf(parsed: unknown): (JsonObject & ChatCompletionsResponse) | null {
  return isJsonObject(parsed) && isChatAnswer(parsed) ? parsed : null;
}

function isAnthropicAnswer(value: JsonObject): value is JsonObject & AnthropicResponse {
  return hasAnthropicEnvelope(value) && hasAnthropicPayload(value);
}

function hasAnthropicEnvelope(value: JsonObject): boolean {
  return (
    typeof value['id'] === 'string' && value['type'] === 'message' && value['role'] === 'assistant'
  );
}

function hasAnthropicPayload(value: JsonObject): boolean {
  const stopReason = value['stop_reason'];

  return Array.isArray(value['content']) && (typeof stopReason === 'string' || stopReason === null);
}

function isResponsesAnswer(value: JsonObject): value is JsonObject & ResponsesResponse {
  return (
    typeof value['id'] === 'string' &&
    (value['status'] === 'completed' ||
      value['status'] === 'incomplete' ||
      value['status'] === 'failed') &&
    Array.isArray(value['output'])
  );
}

async function translatedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
  upstreamDialect: Crossing['dialect'],
): Promise<Response> {
  const text = await upstream.text();
  const answer = parsedJson(text);

  if (!isJsonObject(answer) || crossing.dialect === upstreamDialect) {
    return textAnswer(text, upstream, attribution);
  }

  return translatedJsonAnswer(crossing, upstreamDialect, answer, text, upstream, attribution);
}

function translatedResponse(
  from: Crossing['dialect'],
  to: Crossing['dialect'],
  answer: JsonObject,
) {
  if (from === 'chat-completions') {
    return translatedChatResponse(to, answer);
  }

  return translatedProviderResponse(from, to, answer);
}

function translatedChatResponse(to: Crossing['dialect'], answer: JsonObject) {
  const chat = chatAnswerOf(answer);

  return chat === null ? null : translateResponse('chat-completions', to, chat);
}

function translatedProviderResponse(
  from: 'anthropic' | 'responses',
  to: Crossing['dialect'],
  answer: JsonObject,
) {
  if (from === 'anthropic') {
    return isAnthropicAnswer(answer) ? translateResponse('anthropic', to, answer) : null;
  }

  return isResponsesAnswer(answer) ? translateResponse('responses', to, answer) : null;
}

function translatedJsonAnswer(
  crossing: Crossing,
  upstreamDialect: Crossing['dialect'],
  answer: JsonObject,
  text: string,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  const crossed = translatedResponse(upstreamDialect, crossing.dialect, answer);

  if (crossed === null || 'outcome' in crossed) {
    return textAnswer(text, upstream, attribution);
  }

  if ('refusal' in crossed) {
    return refusalResponse(crossing.dialect, crossed.refusal);
  }

  const value = attributedAnswer(crossing, crossed.value);

  return jsonResponse(value, upstream.status, attribution);
}

function attributedAnswer(crossing: Crossing, value: unknown): unknown {
  return crossing.dialect === 'anthropic' && isJsonObject(value) && isAnthropicAnswer(value)
    ? answeredBy(value, crossing.providerModel)
    : value;
}

async function completedResponsesAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Promise<Response> {
  if (upstream.body === null) {
    return unreachableTargetAnswer(crossing);
  }

  let completed: (JsonObject & ResponsesResponse) | null = null;

  for await (const event of jsonEventsFrom(upstream.body)) {
    const response = terminalResponseIn(event);

    if (response !== null) {
      completed = response;
    }
  }

  return completed === null
    ? unreachableTargetAnswer(crossing)
    : translatedJsonAnswer(
        crossing,
        'responses',
        completed,
        JSON.stringify(completed),
        upstream,
        attribution,
      );
}

function terminalResponseIn(
  event: JsonObject & { type: string },
): (JsonObject & ResponsesResponse) | null {
  const response = event['response'];

  return isJsonObject(response) && isResponsesAnswer(response) ? response : null;
}

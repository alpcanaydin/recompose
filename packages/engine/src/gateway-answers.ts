import type { ChatCompletionsResponse } from './dialect/chat-completions-wire';
import type { Crossing, JsonObject } from './gateway-wire';
import type { AnthropicRefusal } from './refusals';

import { answeredBy, answeringModelInto } from './dialect/anthropic-attribution';
import { translateResponse, translateStream } from './dialect/dispatcher';
import { isJsonObject, jsonResponse, parsedJson, refusalResponse } from './gateway-wire';
import { chatFramesFrom, namedSseBodyFrom } from './stream-wire';

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

export async function answerFrom(crossing: Crossing, upstream: Response): Promise<Response> {
  const attribution = attributionOf(crossing);

  if (!upstream.ok) {
    return passedAlong(upstream, attribution);
  }

  if (upstream.headers.get('content-type')?.includes('text/event-stream') === true) {
    return streamedAnswer(crossing, upstream, attribution);
  }

  return translatedAnswer(crossing, upstream, attribution);
}

function streamedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  if (crossing.dialect === 'chat-completions') {
    return passedAlong(upstream, attribution);
  }

  return anthropicStreamedAnswer(crossing, upstream, attribution);
}

function anthropicStreamedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  const body = upstream.body;
  const crossed =
    body === null ? null : translateStream('chat-completions', 'anthropic', chatFramesFrom(body));

  if (crossed === null || 'outcome' in crossed) {
    return passedAlong(upstream, attribution);
  }

  return new Response(
    namedSseBodyFrom(answeringModelInto(crossed.stream, crossing.providerModel)),
    {
      status: upstream.status,
      headers: { ...attribution, 'content-type': 'text/event-stream' },
    },
  );
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

async function translatedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Promise<Response> {
  const text = await upstream.text();
  const answer = chatAnswerOf(parsedJson(text));

  if (answer === null || crossing.dialect === 'chat-completions') {
    return textAnswer(text, upstream, attribution);
  }

  return anthropicAnswer(crossing, answer, text, upstream, attribution);
}

function anthropicAnswer(
  crossing: Crossing,
  answer: ChatCompletionsResponse,
  text: string,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  const crossed = translateResponse('chat-completions', 'anthropic', answer);

  if ('outcome' in crossed) {
    return textAnswer(text, upstream, attribution);
  }

  if ('refusal' in crossed) {
    return refusalResponse(crossing.dialect, crossed.refusal);
  }

  return jsonResponse(
    answeredBy(crossed.value, crossing.providerModel),
    upstream.status,
    attribution,
  );
}

import type { ChatCompletionsResponse } from './dialect/chat-completions-wire';
import type { Crossing, JsonObject } from './gateway-wire';
import type { AnthropicRefusal } from './refusals';

import { translateResponse, translateStream } from './dialect/dispatcher';
import { isJsonObject, jsonResponse, parsedJson, refusalResponse } from './gateway-wire';
import { chatFramesFrom, sseBodyFrom } from './stream-wire';

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
  if (upstream.body === null) {
    return passedAlong(upstream, attribution);
  }

  const crossed = translateStream(
    'chat-completions',
    crossing.dialect,
    chatFramesFrom(upstream.body),
  );

  if ('outcome' in crossed) {
    return passedAlong(upstream, attribution);
  }

  return new Response(sseBodyFrom(crossed.stream), {
    status: upstream.status,
    headers: { ...attribution, 'content-type': 'text/event-stream' },
  });
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

async function translatedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Promise<Response> {
  const text = await upstream.text();
  const parsed = parsedJson(text);

  if (!isJsonObject(parsed) || !isChatAnswer(parsed)) {
    return textAnswer(text, upstream, attribution);
  }

  const crossed = translateResponse('chat-completions', crossing.dialect, parsed);

  if ('outcome' in crossed) {
    return textAnswer(text, upstream, attribution);
  }

  if ('refusal' in crossed) {
    return refusalResponse(crossing.dialect, crossed.refusal);
  }

  return jsonResponse(crossed.value, upstream.status, attribution);
}

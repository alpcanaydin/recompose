import type { ResponsesResponse } from './dialect/responses-wire';
import type { Crossing, JsonObject, ProviderDialect } from './gateway-wire';
import type { AnthropicRefusal } from './refusals';

import { chatSseUntilDone } from './chat-sse-hygiene';
import { answeredBy, answeringModelInto } from './dialect/anthropic-attribution';
import { isResponsesAnswer, terminalResponseIn } from './dialect/responses-answer-shape';
import { respondingModelInto, responsesAnsweredBy } from './dialect/responses-attribution';
import { restoreResponsesToolResponse } from './dialect/responses-tool-restoration';
import { isAnthropicAnswer, translatedResponse } from './gateway-response-translation';
import { translatedStreamBody } from './gateway-stream-answers';
import {
  isJsonObject,
  jsonResponse,
  parsedJson,
  refusalResponse,
  wantsStream,
} from './gateway-wire';
import { jsonEventsFrom, namedSseBodyFrom } from './stream-wire';
import { codexTerminalErrorAnswer } from './subscription/codex-terminal-error';

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

  for (const name of ['content-type', 'retry-after']) {
    const value = upstream.headers.get(name);

    if (value !== null) headers.set(name, value);
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
  upstreamDialect: ProviderDialect = 'chat-completions',
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
  upstreamDialect: ProviderDialect,
): Promise<Response> {
  if (needsCompletedResponses(upstreamDialect, crossing)) {
    return completedResponsesAnswer(crossing, upstream, attribution);
  }

  if (crossing.dialect === upstreamDialect) {
    return sameDialectStreamedAnswer(crossing, upstream, attribution);
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

function sameDialectStreamedAnswer(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  if (upstream.body === null) return passedAlong(upstream, attribution);

  const body = sameDialectStreamBody(crossing, upstream.body);

  if (body === upstream.body) return passedAlong(upstream, attribution);

  return new Response(body, {
    status: upstream.status,
    headers: upstreamHeaders(upstream, attribution),
  });
}

function sameDialectStreamBody(
  crossing: Crossing,
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  if (crossing.dialect === 'chat-completions') return chatSseUntilDone(body);

  if (crossing.dialect === 'anthropic') {
    return namedSseBodyFrom(answeringModelInto(jsonEventsFrom(body), crossing.providerModel));
  }

  return crossing.dialect === 'responses'
    ? namedSseBodyFrom(respondingModelInto(jsonEventsFrom(body), crossing.virtualModel))
    : body;
}

function needsCompletedResponses(upstreamDialect: ProviderDialect, crossing: Crossing): boolean {
  return upstreamDialect === 'responses' && !wantsStream(crossing.raw);
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
  upstreamDialect: ProviderDialect,
): Promise<Response> {
  const text = await upstream.text();
  const answer = parsedJson(text);

  if (!isJsonObject(answer)) {
    return textAnswer(text, upstream, attribution);
  }

  if (crossing.dialect === upstreamDialect) {
    return sameDialectJsonAnswer(crossing, answer, text, upstream, attribution);
  }

  return translatedJsonAnswer(crossing, upstreamDialect, answer, text, upstream, attribution);
}

function sameDialectJsonAnswer(
  crossing: Crossing,
  answer: JsonObject,
  text: string,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  return crossing.dialect === 'anthropic' && isAnthropicAnswer(answer)
    ? jsonResponse(answeredBy(answer, crossing.providerModel), upstream.status, attribution)
    : textAnswer(text, upstream, attribution);
}

function translatedJsonAnswer(
  crossing: Crossing,
  upstreamDialect: ProviderDialect,
  answer: JsonObject,
  text: string,
  upstream: Response,
  attribution: Record<string, string>,
): Response {
  const crossed = translatedResponse(upstreamDialect, crossing, answer);

  if (crossed === null || 'outcome' in crossed) {
    return textAnswer(text, upstream, attribution);
  }

  if ('refusal' in crossed) {
    return refusalResponse(crossing.dialect, crossed.refusal);
  }

  const restored = restoredResponsesAnswer(crossing, crossed.value);
  const value = attributedAnswer(crossing, restored);

  return jsonResponse(value, upstream.status, attribution);
}

function restoredResponsesAnswer(crossing: Crossing, value: unknown): unknown {
  if (crossing.dialect !== 'responses' || !isJsonObject(value) || !isResponsesAnswer(value)) {
    return value;
  }

  return restoreResponsesToolResponse(value, crossing.responsesToolRefs ?? {});
}

function attributedAnswer(crossing: Crossing, value: unknown): unknown {
  if (!isJsonObject(value)) return value;
  if (crossing.dialect === 'anthropic') return attributedAnthropic(crossing, value);
  if (crossing.dialect === 'responses') return attributedResponses(crossing, value);

  return value;
}

function attributedAnthropic(crossing: Crossing, value: JsonObject): unknown {
  return isAnthropicAnswer(value) ? answeredBy(value, crossing.providerModel) : value;
}

function attributedResponses(crossing: Crossing, value: JsonObject): unknown {
  if (!isResponsesAnswer(value)) return value;

  const answer = responsesAnsweredBy(value, crossing.virtualModel);
  const tools = crossing.raw['tools'];

  return Array.isArray(tools) ? { ...answer, tools } : answer;
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
    const failure = await codexTerminalErrorAnswer(event, crossing.dialect, attribution);

    if (failure !== null) return failure;

    const response = terminalResponseIn(event);

    if (response !== null) {
      completed = response;
    }
  }

  return completedResponsesResult(crossing, upstream, attribution, completed);
}

function completedResponsesResult(
  crossing: Crossing,
  upstream: Response,
  attribution: Record<string, string>,
  completed: (JsonObject & ResponsesResponse) | null,
): Response {
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

import type { GeminiPart, GeminiResponse } from './gemini-wire';

import {
  detachedGeminiSignature as detachedSignature,
  geminiReasoningSignature as reasoningSignature,
  geminiResponseSignature as signatureOf,
  isVisibleGeminiText as isVisibleText,
} from './gemini-responses-signature-helpers';
import { normalizeGeminiResponsesTextParts } from './gemini-responses-text-signatures';

type StreamState = { pending?: GeminiResponse };

function responseParts(response: GeminiResponse): GeminiPart[] {
  return response.candidates?.[0]?.content?.parts ?? [];
}

function withParts(response: GeminiResponse, parts: GeminiPart[]): GeminiResponse {
  const candidate = response.candidates?.[0];
  const content = candidate?.content;

  if (candidate === undefined || content === undefined) return response;

  return { ...response, candidates: [{ ...candidate, content: { ...content, parts } }] };
}

function hasFinish(response: GeminiResponse): boolean {
  const candidate = response.candidates?.[0];

  return candidate?.finishReason !== undefined || candidate?.finish_reason !== undefined;
}

function endsWithPendingPart(response: GeminiResponse): boolean {
  const last = responseParts(response).at(-1);

  return last !== undefined && (isVisibleText(last) || last.thought === true);
}

function leadingDetached(response: GeminiResponse): string | undefined {
  const first = responseParts(response)[0];

  return first === undefined ? undefined : detachedSignature(first);
}

function isDetachedOnly(response: GeminiResponse): boolean {
  return responseParts(response).length === 1 && leadingDetached(response) !== undefined;
}

function signedPart(part: GeminiPart, signature: string): GeminiPart {
  return { ...part, thoughtSignature: signature, responsesSignatureDirection: 'previous' };
}

function attachToLastText(response: GeminiResponse, signature: string): GeminiResponse {
  const parts = responseParts(response);
  const last = parts.at(-1);

  return last === undefined
    ? response
    : withParts(response, [...parts.slice(0, -1), signedPart(last, signature)]);
}

function withoutLeadingPart(response: GeminiResponse): GeminiResponse {
  return withParts(response, responseParts(response).slice(1));
}

function combineCarrierResponse(carrier: GeminiResponse, response: GeminiResponse): GeminiResponse {
  return withParts(response, [...responseParts(carrier), ...responseParts(response)]);
}

function terminalResponse(content: GeminiResponse, terminal: GeminiResponse): GeminiResponse {
  const candidate = content.candidates?.[0];
  const terminalCandidate = terminal.candidates?.[0];

  if (candidate === undefined || terminalCandidate === undefined) return content;

  return {
    ...content,
    ...terminal,
    candidates: [mergedCandidate(candidate, terminalCandidate)],
  };
}

function mergedCandidate(
  candidate: NonNullable<GeminiResponse['candidates']>[number],
  terminal: NonNullable<GeminiResponse['candidates']>[number],
) {
  return candidate.content === undefined
    ? { ...candidate, ...terminal }
    : { ...candidate, ...terminal, content: candidate.content };
}

function visiblePart(response: GeminiResponse): GeminiPart | undefined {
  const parts = responseParts(response);
  const part = parts[0];

  return parts.length === 1 && part !== undefined && isVisibleText(part) ? part : undefined;
}

function combinableVisibleParts(
  previous: GeminiResponse,
  current: GeminiResponse,
): { previous: GeminiPart; next: GeminiPart } | null {
  const first = visiblePart(previous);
  const next = visiblePart(current);

  if (first === undefined || next === undefined) return null;
  if (signatureOf(first.thoughtSignature) !== undefined) return null;

  return { previous: first, next };
}

function combinedVisibleResponse(
  pending: GeminiResponse,
  current: GeminiResponse,
): GeminiResponse | null {
  const pair = combinableVisibleParts(pending, current);

  if (pair === null) return null;

  return withParts(terminalResponse(pending, current), [combinedVisiblePart(pair)]);
}

function combinedReasoningResponse(
  pending: GeminiResponse,
  current: GeminiResponse,
): GeminiResponse | null {
  const previous = responseParts(pending).at(-1);
  const next = responseParts(current)[0];

  if (!canCombineReasoning(previous, next)) return null;
  if (next === undefined) return null;

  const parts = normalizeGeminiResponsesTextParts([previous, next]);

  return withParts(terminalResponse(pending, current), parts);
}

function canCombineReasoning(
  previous: GeminiPart | undefined,
  next: GeminiPart | undefined,
): previous is GeminiPart {
  if (previous === undefined) return false;
  if (next === undefined) return false;
  if (previous.thought !== true) return false;

  if (reasoningSignature(previous.thoughtSignature) !== undefined) {
    return canAppendUnsignedThought(previous, next);
  }

  return combinableNext(next);
}

function canAppendUnsignedThought(previous: GeminiPart, next: GeminiPart): boolean {
  if (previous.text !== '') return false;
  if (next.thought !== true) return false;

  return reasoningSignature(next.thoughtSignature) === undefined;
}

function combinableNext(next: GeminiPart): boolean {
  return (
    next.thought === true ||
    (isVisibleText(next) && signatureOf(next.thoughtSignature) !== undefined)
  );
}

function combinedVisiblePart(pair: { previous: GeminiPart; next: GeminiPart }): GeminiPart {
  const signature =
    signatureOf(pair.next.thoughtSignature) ?? signatureOf(pair.previous.thoughtSignature);
  const part = { ...pair.next, text: `${pair.previous.text ?? ''}${pair.next.text ?? ''}` };

  return signature === undefined ? part : signedPart(part, signature);
}

function storeOrEmit(state: StreamState, response: GeminiResponse): GeminiResponse[] {
  if (isDetachedOnly(response) && !hasFinish(response)) {
    state.pending = response;

    return [];
  }

  const parts = normalizeGeminiResponsesTextParts(responseParts(response));
  const current = withParts(response, parts);

  if (endsWithPendingPart(current) && !hasFinish(current)) {
    state.pending = current;

    return [];
  }

  return [current];
}

function attachLeadingDetached(state: StreamState, response: GeminiResponse): GeminiResponse {
  const detached = leadingDetached(response);

  if (state.pending === undefined || detached === undefined) return response;
  if (!canAttachToLastText(state.pending)) return response;

  state.pending = attachToLastText(state.pending, detached);

  return withoutLeadingPart(response);
}

function canAttachToLastText(response: GeminiResponse): boolean {
  const last = responseParts(response).at(-1);

  return (
    last !== undefined && isVisibleText(last) && signatureOf(last.thoughtSignature) === undefined
  );
}

function pendingCarrierResponse(state: StreamState, raw: GeminiResponse): GeminiResponse[] | null {
  const pending = state.pending;

  if (pending === undefined || !isDetachedOnly(pending)) return null;

  delete state.pending;

  return storeOrEmit(state, combineCarrierResponse(pending, raw));
}

function processPendingResponse(
  state: StreamState,
  pending: GeminiResponse,
  current: GeminiResponse,
): GeminiResponse[] {
  const combined = combinedVisibleResponse(pending, current);

  if (combined !== null) return storeOrEmit(state, combined);

  const reasoning = combinedReasoningResponse(pending, current);

  if (reasoning !== null) return storeOrEmit(state, reasoning);

  if (responseParts(current).length === 0 && hasFinish(current)) {
    return [terminalResponse(pending, current)];
  }

  return [pending, ...storeOrEmit(state, current)];
}

function processResponse(state: StreamState, raw: GeminiResponse): GeminiResponse[] {
  const carrier = pendingCarrierResponse(state, raw);

  if (carrier !== null) return carrier;

  const current = attachLeadingDetached(state, raw);
  const pending = state.pending;

  if (pending === undefined) return storeOrEmit(state, current);

  delete state.pending;

  return processPendingResponse(state, pending, current);
}

export async function* normalizeGeminiResponsesTextStream(
  source: AsyncIterable<GeminiResponse>,
): AsyncIterable<GeminiResponse> {
  const state: StreamState = {};

  for await (const response of source) yield* processResponse(state, response);

  if (state.pending !== undefined) yield state.pending;
}

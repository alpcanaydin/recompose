import type { GeminiPart, GeminiResponse } from './gemini-wire';

import {
  detachedGeminiSignature as detachedSignature,
  geminiReasoningSignature as reasoningSignature,
  geminiResponseSignature as textSignature,
  isVisibleGeminiText as isVisibleText,
} from './gemini-responses-signature-helpers';

type SignatureDirection = 'next' | 'previous';
type PartState = { parts: GeminiPart[]; pending?: string; detachedDirection: SignatureDirection };

function signedPart(
  part: GeminiPart,
  signature: string | undefined,
  direction?: SignatureDirection,
): GeminiPart {
  if (signature === undefined) return part;

  return {
    ...part,
    thoughtSignature: signature,
    ...(direction === undefined ? {} : { responsesSignatureDirection: direction }),
  };
}

function appendDetached(state: PartState, signature: string): void {
  const last = state.parts.at(-1);

  if (
    last !== undefined &&
    isVisibleText(last) &&
    textSignature(last.thoughtSignature) === undefined
  ) {
    state.parts[state.parts.length - 1] = signedPart(last, signature, state.detachedDirection);

    return;
  }

  if (state.pending !== undefined) {
    state.parts.push(carrierPart(state.pending, 'standalone', 'any'));
  }

  state.pending = signature;
}

function appendPart(state: PartState, part: GeminiPart): void {
  const detached = detachedSignature(part);

  if (detached !== undefined) {
    appendDetached(state, detached);

    return;
  }

  if (isEmptyUnsignedText(part)) return;

  appendContentPart(state, part);
}

function appendContentPart(state: PartState, part: GeminiPart): void {
  if (part.thought === true) {
    appendThought(state, part);

    return;
  }

  if (completeVisibleThought(state, part)) return;

  appendNormalizedPart(state, part);
}

function completeVisibleThought(state: PartState, part: GeminiPart): boolean {
  return isVisibleText(part) && completePendingThought(state, part);
}

function appendNormalizedPart(state: PartState, part: GeminiPart): void {
  if (state.pending !== undefined && !isSignatureTarget(part)) {
    state.parts.push(carrierPart(state.pending, 'next', 'any'));
  }

  state.parts.push(normalizedPart(state, part));

  delete state.pending;
}

function appendThought(state: PartState, part: GeminiPart): void {
  if (state.pending !== undefined) {
    state.parts.push(carrierPart(state.pending, 'next', 'any'));
    delete state.pending;
  }

  const last = state.parts.at(-1);

  if (last?.thought === true && canMergeThought(last, part)) {
    mergeThought(state, last, part);
  } else {
    state.parts.push(part);
  }
}

function canMergeThought(previous: GeminiPart, next: GeminiPart): boolean {
  if (reasoningSignature(previous.thoughtSignature) === undefined) return true;

  return previous.text === '' && reasoningSignature(next.thoughtSignature) === undefined;
}

function mergeThought(state: PartState, last: GeminiPart, part: GeminiPart): void {
  const text = `${last.text ?? ''}${part.text ?? ''}`;

  state.parts[state.parts.length - 1] = signedPart(
    { ...part, text },
    reasoningSignature(part.thoughtSignature) ?? reasoningSignature(last.thoughtSignature),
  );
}

function completePendingThought(state: PartState, part: GeminiPart): boolean {
  const signature = textSignature(part.thoughtSignature);
  const last = state.parts.at(-1);

  if (signature === undefined || last?.thought !== true) return false;
  if (textSignature(last.thoughtSignature) !== undefined) return false;

  state.parts[state.parts.length - 1] = signedPart(last, signature);
  state.parts.push(withoutThoughtSignature(part));
  delete state.pending;

  return true;
}

function withoutThoughtSignature(part: GeminiPart): GeminiPart {
  const { thoughtSignature: _signature, ...unsigned } = part;

  return unsigned;
}

function isSignatureTarget(part: GeminiPart): boolean {
  return isVisibleText(part) || part.functionCall !== undefined;
}

function carrierPart(
  signature: string,
  direction: 'next' | 'previous' | 'standalone',
  target: 'text' | 'function' | 'any',
): GeminiPart {
  return {
    text: '',
    thought: true,
    thoughtSignature: signature,
    ...(direction === 'standalone' ? {} : { responsesSignatureDirection: direction }),
    responsesSignatureTarget: target,
  };
}

function isEmptyUnsignedText(part: GeminiPart): boolean {
  if (part.functionCall !== undefined || part.thought === true) return false;

  return part.text === '' && textSignature(part.thoughtSignature) === undefined;
}

function normalizedPart(state: PartState, part: GeminiPart): GeminiPart {
  if (isVisibleText(part)) return normalizedVisiblePart(state, part);
  if (part.functionCall !== undefined) return signedPart(part, state.pending);

  return part;
}

function normalizedVisiblePart(state: PartState, part: GeminiPart): GeminiPart {
  const direct = textSignature(part.thoughtSignature);

  preservePendingBeforeDirect(state, direct);

  const direction = direct === undefined ? undefined : 'previous';

  return signedPart(part, direct ?? state.pending, direction);
}

function preservePendingBeforeDirect(state: PartState, direct: string | undefined): void {
  if (direct === undefined || state.pending === undefined) return;

  state.parts.push(carrierPart(state.pending, 'standalone', 'any'));
  delete state.pending;
}

export function normalizeGeminiResponsesTextParts(
  parts: readonly GeminiPart[],
  detachedDirection: SignatureDirection = 'previous',
): GeminiPart[] {
  const state: PartState = { parts: [], detachedDirection };

  for (const part of parts) appendPart(state, part);

  appendPendingCarrier(state);

  return state.parts;
}

function appendPendingCarrier(state: PartState): void {
  if (state.pending === undefined) return;

  const target = state.parts.at(-1)?.functionCall === undefined ? 'any' : 'function';
  const direction = target === 'function' ? 'previous' : 'standalone';

  state.parts.push(carrierPart(state.pending, direction, target));
  delete state.pending;
}

export function normalizeGeminiResponsesTextResponse(response: GeminiResponse): GeminiResponse {
  const candidate = response.candidates?.[0];
  const content = candidate?.content;

  if (candidate === undefined || content === undefined) return response;

  const parts = normalizeGeminiResponsesTextParts(content.parts, 'next');

  return { ...response, candidates: [{ ...candidate, content: { ...content, parts } }] };
}

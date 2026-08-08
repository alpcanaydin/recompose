import type {
  ResponsesInputItem,
  ResponsesReasoningItem,
  ResponsesRequest,
} from './responses-wire';

import {
  decodeGeminiResponsesCarrier,
  encodeGeminiResponsesCarrier,
} from '../provider/gemini-responses-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { normalizeGeminiOutputOrder } from './responses-gemini-output-order';

type Target = 'text' | 'function' | 'any';
type Binding = { signature: string; target: Exclude<Target, 'any'> };
type TargetRef = { index: number; target: Exclude<Target, 'any'> };
type Carrier = {
  signature: string;
  direction: 'next' | 'previous' | 'standalone';
  target: Target;
  raw: boolean;
};

function carrierOf(item: ResponsesInputItem): Carrier | null {
  if (item.type !== 'reasoning') return null;

  return reasoningCarrier(item);
}

function reasoningCarrier(item: ResponsesReasoningItem): Carrier | null {
  if (typeof item.encrypted_content !== 'string') return null;

  const decoded = decodeGeminiResponsesCarrier(item.encrypted_content);

  if (decoded.marked) return markedCarrier(decoded);

  const signature = nativeGeminiSignature(item.encrypted_content);

  return signature === null || isGeminiBypass(signature)
    ? null
    : { signature, direction: 'next', target: 'function', raw: true };
}

function markedCarrier(decoded: ReturnType<typeof decodeGeminiResponsesCarrier>): Carrier | null {
  if (!decoded.marked || !decoded.valid) return null;

  return { ...decoded, target: decoded.target, raw: false };
}

function targetMatches(item: ResponsesInputItem | undefined, target: Target): boolean {
  if (target === 'any') return false;
  if (target === 'function') return isFunctionCall(item);

  return isAssistantMessage(item);
}

function isFunctionCall(item: ResponsesInputItem | undefined): boolean {
  return item?.type === 'function_call';
}

function isAssistantMessage(item: ResponsesInputItem | undefined): boolean {
  if (item?.type !== 'message') return false;

  return item.role === 'assistant';
}

function targetOf(
  input: readonly ResponsesInputItem[],
  index: number,
  carrier: Carrier,
): TargetRef | null {
  if (carrier.raw) return rawTargetOf(input, index);
  if (carrier.direction === 'standalone') return null;

  return directionalTargetOf(input, index, carrier);
}

function directionalTargetOf(
  input: readonly ResponsesInputItem[],
  index: number,
  carrier: Carrier,
): TargetRef | null {
  const targetIndex = carrier.direction === 'next' ? index + 1 : index - 1;

  return targetMatches(input[targetIndex], carrier.target) && carrier.target !== 'any'
    ? { index: targetIndex, target: carrier.target }
    : null;
}

function rawTargetOf(input: readonly ResponsesInputItem[], index: number): TargetRef | null {
  return (
    previousFunctionTarget(input, index) ??
    nextRawTarget(input, index) ??
    previousTextTarget(input, index)
  );
}

function previousFunctionTarget(
  input: readonly ResponsesInputItem[],
  index: number,
): TargetRef | null {
  const previous = input[index - 1];

  if (previous?.type === 'function_call' && hasMatchingOutput(input, index, previous.call_id)) {
    return { index: index - 1, target: 'function' };
  }

  return null;
}

function nextRawTarget(input: readonly ResponsesInputItem[], index: number): TargetRef | null {
  const next = input[index + 1];

  if (next?.type === 'function_call') return { index: index + 1, target: 'function' };
  if (isOutputMessage(next)) return { index: index + 1, target: 'text' };

  return null;
}

function previousTextTarget(input: readonly ResponsesInputItem[], index: number): TargetRef | null {
  const previous = input[index - 1];

  if (isOutputMessage(previous)) return { index: index - 1, target: 'text' };

  return null;
}

function isOutputMessage(item: ResponsesInputItem | undefined): boolean {
  if (item?.type !== 'message') return false;
  if (item.role === 'assistant') return true;
  if (typeof item.content === 'string') return false;

  return item.content.some((part) => part.type === 'output_text');
}

function hasMatchingOutput(
  input: readonly ResponsesInputItem[],
  carrierIndex: number,
  callId: string,
): boolean {
  for (let index = carrierIndex + 1; index < input.length; index += 1) {
    const decision = outputDecision(input[index], callId);

    if (decision !== null) return decision;
  }

  return false;
}

function outputDecision(item: ResponsesInputItem | undefined, callId: string): boolean | null {
  if (isMessageBoundary(item)) return false;

  return matchesOutput(item, callId) ? true : null;
}

function isMessageBoundary(item: ResponsesInputItem | undefined): boolean {
  return item?.type === 'message';
}

function matchesOutput(item: ResponsesInputItem | undefined, callId: string): boolean {
  return item?.type === 'function_call_output' && item.call_id === callId;
}

type BindingState = { targets: Map<number, Binding>; carriers: Set<number> };

function bindingsOf(input: readonly ResponsesInputItem[]): BindingState {
  const state: BindingState = { targets: new Map(), carriers: new Set() };

  for (const [index, item] of input.entries()) {
    const carrier = carrierOf(item);

    if (carrier === null) continue;

    bindCarrier(state, input, index, carrier);
  }

  return state;
}

function bindCarrier(
  state: BindingState,
  input: readonly ResponsesInputItem[],
  index: number,
  carrier: Carrier,
): void {
  const target = availableTarget(state, input, index, carrier);

  if (target === null) return;

  state.targets.set(target.index, { signature: carrier.signature, target: target.target });
  state.carriers.add(index);
}

function availableTarget(
  state: BindingState,
  input: readonly ResponsesInputItem[],
  index: number,
  carrier: Carrier,
): TargetRef | null {
  const target = targetOf(input, index, carrier);

  if (target === null) return null;
  if (!state.targets.has(target.index)) return target;

  return carrier.raw ? availableRawTarget(state, input, index) : null;
}

function availableRawTarget(
  state: BindingState,
  input: readonly ResponsesInputItem[],
  index: number,
): TargetRef | null {
  const next = nextRawTarget(input, index);

  return next === null || state.targets.has(next.index) ? null : next;
}

function unsignedReasoning(item: ResponsesReasoningItem): ResponsesReasoningItem {
  const { encrypted_content: _encryptedContent, ...reasoning } = item;

  return reasoning;
}

function standaloneReasoning(
  item: ResponsesReasoningItem,
  signature: string,
): ResponsesReasoningItem {
  return { ...item, encrypted_content: `anthropic:${signature}` };
}

function canonicalCarrier(binding: Binding): ResponsesReasoningItem {
  return {
    type: 'reasoning',
    summary: [],
    content: null,
    encrypted_content: encodeGeminiResponsesCarrier({
      signature: binding.signature,
      direction: 'next',
      target: binding.target,
    }),
  };
}

function canonicalItems(input: readonly ResponsesInputItem[]): ResponsesInputItem[] {
  const bindings = bindingsOf(input);

  return input.flatMap((item, index) => canonicalItem(item, index, bindings));
}

function canonicalItem(
  item: ResponsesInputItem,
  index: number,
  bindings: BindingState,
): ResponsesInputItem[] {
  const binding = bindings.targets.get(index);
  const prefix = binding === undefined ? [] : [canonicalCarrier(binding)];

  if (item.type !== 'reasoning') return [...prefix, boundTargetItem(item, binding)];

  const carrier = reasoningCarrier(item);

  if (carrier === null) return [...prefix, boundTargetItem(item, binding)];

  return canonicalReasoning(item, carrier, bindings.carriers.has(index));
}

function boundTargetItem(
  item: ResponsesInputItem,
  binding: Binding | undefined,
): ResponsesInputItem {
  if (binding?.target !== 'text' || item.type !== 'message') return item;

  return { ...item, role: 'assistant' };
}

function canonicalReasoning(
  item: ResponsesReasoningItem,
  carrier: Carrier,
  bound: boolean,
): ResponsesInputItem[] {
  if (!bound) return [standaloneReasoning(item, carrier.signature)];
  if (!carrier.raw) return [];

  return hasReasoningText(item) ? [unsignedReasoning(item)] : [];
}

function hasReasoningText(item: ResponsesReasoningItem): boolean {
  const summary = item.summary ?? [];
  const content = item.content ?? [];

  return summary.some((part) => part.text !== '') || content.some((part) => part.text !== '');
}

export function normalizeResponsesGeminiRequestState(request: ResponsesRequest): ResponsesRequest {
  const canonical = canonicalItems(request.input);

  return { ...request, input: normalizeGeminiOutputOrder(canonical) };
}

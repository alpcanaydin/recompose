import type { Fate } from './fates';
import type { HubMessage, HubToolUseBlock } from './hub';
import type {
  ResponsesFunctionCallItem,
  ResponsesInputItem,
  ResponsesReasoningItem,
} from './responses-wire';

import {
  compatibleGeminiCarrierSignature,
  decodeGeminiResponsesCarrier,
  encodeGeminiResponsesCarrier,
} from '../provider/gemini-responses-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import { functionCallItemOf, toolUseBlockOf } from './responses-shared';

type GeminiCarrierFold = {
  block: HubToolUseBlock | null;
  consumed: number;
  fates: Fate[];
};

type FoldedItems = { messages: HubMessage[]; fates: Fate[] };
type FoldItem = (item: ResponsesInputItem) => FoldedItems;

function carrierReasoning(signature: string): ResponsesReasoningItem {
  return {
    type: 'reasoning',
    summary: [],
    content: null,
    encrypted_content: encodeGeminiResponsesCarrier({
      signature,
      direction: 'next',
      target: 'function',
    }),
  };
}

export function responsesItemsForGeminiToolUse(
  block: HubToolUseBlock,
): [ResponsesReasoningItem, ResponsesFunctionCallItem] | [ResponsesFunctionCallItem] {
  const signature = nativeGeminiSignature(block.signature);
  const call = functionCallItemOf(block);

  return signature === null || isGeminiBypass(signature)
    ? [call]
    : [carrierReasoning(signature), call];
}

function droppedCarrierFate(): Fate[] {
  return [{ field: 'encrypted_content', disposition: 'mapped', to: 'absent' }];
}

function validNextFunctionCarrier(
  decoded: ReturnType<typeof decodeGeminiResponsesCarrier>,
): decoded is Extract<
  ReturnType<typeof decodeGeminiResponsesCarrier>,
  { marked: true; valid: true }
> {
  if (!decoded.marked) return false;
  if (!decoded.valid) return false;

  return decoded.direction === 'next' && decoded.target === 'function';
}

function carriedFunctionFold(
  next: ResponsesFunctionCallItem,
  encrypted: string,
): GeminiCarrierFold {
  const signature = compatibleGeminiCarrierSignature(encrypted);

  return signature === null
    ? { block: null, consumed: 1, fates: droppedCarrierFate() }
    : {
        block: toolUseBlockOf(next, signature),
        consumed: 2,
        fates: [{ field: 'encrypted_content', disposition: 'carried' }],
      };
}

function foldGeminiFunctionCarrier(
  item: ResponsesReasoningItem,
  next: ResponsesFunctionCallItem | undefined,
): GeminiCarrierFold | null {
  const encrypted = item.encrypted_content;

  if (typeof encrypted !== 'string') return null;

  const decoded = decodeGeminiResponsesCarrier(encrypted);

  if (!decoded.marked) return null;

  if (!validNextFunctionCarrier(decoded)) {
    return { block: null, consumed: 1, fates: droppedCarrierFate() };
  }

  if (next === undefined) return { block: null, consumed: 1, fates: droppedCarrierFate() };

  return carriedFunctionFold(next, encrypted);
}

function carrierMessages(
  carrier: GeminiCarrierFold,
  next: ResponsesInputItem | undefined,
  answeredCalls: ReadonlySet<string>,
): HubMessage[] {
  return carrier.block !== null && next?.type === 'function_call' && answeredCalls.has(next.call_id)
    ? [{ role: 'assistant', content: [carrier.block] }]
    : [];
}

function foldedAt(
  input: readonly ResponsesInputItem[],
  index: number,
  answeredCalls: ReadonlySet<string>,
  foldItem: FoldItem,
): { outcome: FoldedItems; consumed: number } {
  const item = input[index];

  if (item === undefined) return { outcome: { messages: [], fates: [] }, consumed: 1 };
  if (item.type !== 'reasoning') return { outcome: foldItem(item), consumed: 1 };

  const next = nextFunctionCall(input, index);
  const carrier = foldGeminiFunctionCarrier(item, next);

  if (carrier === null) return { outcome: foldItem(item), consumed: 1 };

  return {
    outcome: { messages: carrierMessages(carrier, next, answeredCalls), fates: carrier.fates },
    consumed: carrier.consumed,
  };
}

function nextFunctionCall(
  input: readonly ResponsesInputItem[],
  index: number,
): ResponsesFunctionCallItem | undefined {
  const next = input[index + 1];

  return next?.type === 'function_call' ? next : undefined;
}

export function foldResponsesInputWithGeminiCarriers(
  input: readonly ResponsesInputItem[],
  answeredCalls: ReadonlySet<string>,
  foldItem: FoldItem,
): FoldedItems {
  const folded: FoldedItems = { messages: [], fates: [] };

  for (let index = 0; index < input.length; index += 1) {
    const current = foldedAt(input, index, answeredCalls, foldItem);

    folded.messages.push(...current.outcome.messages);
    folded.fates.push(...current.outcome.fates);
    index += current.consumed - 1;
  }

  return folded;
}

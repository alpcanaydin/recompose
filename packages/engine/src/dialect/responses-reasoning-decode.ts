import type { Fate } from './fates';
import type { HubContentBlock, HubMessage, HubThinkingBlock } from './hub';
import type { ResponsesReasoningItem } from './responses-wire';

import {
  classifyReasoningSignature,
  redactedThinkingBlockOf,
  signedThinkingBlockOf,
  thinkingBlockOf,
} from './responses-shared';

export type ReasoningOutcome = { blocks: HubContentBlock[]; fates: Fate[] };
export type FoldedReasoning = { messages: HubMessage[]; fates: Fate[] };

function thinkingOutcome(block: HubThinkingBlock, carriedFates: Fate[]): ReasoningOutcome {
  if (block.text.length > 0) {
    return { blocks: [block], fates: carriedFates };
  }

  return { blocks: [], fates: carriedFates.map((fate) => ({ ...fate, to: 'absent' })) };
}

const encryptedContentAbsent: Fate = {
  field: 'encrypted_content',
  disposition: 'mapped',
  to: 'absent',
};

export function reasoningOutcome(
  item: ResponsesReasoningItem,
  preserveIncompatible = false,
): ReasoningOutcome {
  if (item.encrypted_content === '' && !preserveIncompatible) return { blocks: [], fates: [] };

  const classified = classifyReasoningSignature(item.encrypted_content);

  return classifiedOutcome(item, classified, preserveIncompatible);
}

function classifiedOutcome(
  item: ResponsesReasoningItem,
  classified: ReturnType<typeof classifyReasoningSignature>,
  preserveIncompatible: boolean,
): ReasoningOutcome {
  switch (classified.kind) {
    case 'none':
      return unsignedOutcome(item, preserveIncompatible);
    case 'compatible':
      return {
        blocks: [signedThinkingBlockOf(item, classified.signature)],
        fates: [{ field: 'encrypted_content', disposition: 'mapped', to: 'thinking.signature' }],
      };
    case 'redacted':
      return {
        blocks: [redactedThinkingBlockOf(classified.data)],
        fates: [{ field: 'encrypted_content', disposition: 'mapped', to: 'redacted_thinking' }],
      };
    case 'foreign':
      return foreignOutcome(item, preserveIncompatible);

    default: {
      const unhandled: never = classified;

      throw new Error(`unhandled reasoning signature: ${JSON.stringify(unhandled)}`);
    }
  }
}

function unsignedOutcome(
  item: ResponsesReasoningItem,
  preserveIncompatible: boolean,
): ReasoningOutcome {
  const block = thinkingBlockOf(item);

  return preserveIncompatible && block.text === ''
    ? { blocks: [{ ...block, text: '[reasoning unavailable]', signature: '' }], fates: [] }
    : thinkingOutcome(block, []);
}

function foreignOutcome(
  item: ResponsesReasoningItem,
  preserveIncompatible: boolean,
): ReasoningOutcome {
  if (preserveIncompatible && item.encrypted_content !== undefined) {
    return {
      blocks: [signedThinkingBlockOf(item, item.encrypted_content)],
      fates: [{ field: 'encrypted_content', disposition: 'mapped', to: 'thinking.signature' }],
    };
  }

  return thinkingOutcome(thinkingBlockOf(item), [encryptedContentAbsent]);
}

export function foldReasoning(
  item: ResponsesReasoningItem,
  preserveIncompatible = false,
): FoldedReasoning {
  const { blocks, fates } = reasoningOutcome(item, preserveIncompatible);

  return { messages: blocks.length > 0 ? [{ role: 'assistant', content: blocks }] : [], fates };
}

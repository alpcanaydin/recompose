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

export function reasoningOutcome(item: ResponsesReasoningItem): ReasoningOutcome {
  const classified = classifyReasoningSignature(item.encrypted_content);

  switch (classified.kind) {
    case 'none':
      return thinkingOutcome(thinkingBlockOf(item), []);
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
      return thinkingOutcome(thinkingBlockOf(item), [encryptedContentAbsent]);

    default: {
      const unhandled: never = classified;

      throw new Error(`unhandled reasoning signature: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function foldReasoning(item: ResponsesReasoningItem): FoldedReasoning {
  const { blocks, fates } = reasoningOutcome(item);

  return { messages: blocks.length > 0 ? [{ role: 'assistant', content: blocks }] : [], fates };
}

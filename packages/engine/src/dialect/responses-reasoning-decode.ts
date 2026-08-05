import type { Fate } from './fates';
import type { HubContentBlock, HubMessage, HubThinkingBlock } from './hub';
import type { ResponsesReasoningItem } from './responses-wire';

import {
  classifyReasoningSignature,
  redactedThinkingBlockOf,
  signedThinkingBlockOf,
  thinkingBlockOf,
} from './responses-shared';

export type FoldedReasoning = { messages: HubMessage[]; fates: Fate[] };

function assistantWith(content: HubContentBlock): HubMessage {
  return { role: 'assistant', content: [content] };
}

function keepOrDropThinking(block: HubThinkingBlock, carriedFates: Fate[]): FoldedReasoning {
  if (block.text.length > 0) {
    return { messages: [assistantWith(block)], fates: carriedFates };
  }

  return { messages: [], fates: carriedFates.map((fate) => ({ ...fate, to: 'absent' })) };
}

const encryptedContentAbsent: Fate = {
  field: 'encrypted_content',
  disposition: 'mapped',
  to: 'absent',
};

export function foldReasoning(item: ResponsesReasoningItem): FoldedReasoning {
  const classified = classifyReasoningSignature(item.encrypted_content);

  switch (classified.kind) {
    case 'none':
      return keepOrDropThinking(thinkingBlockOf(item), []);
    case 'compatible':
      return keepOrDropThinking(signedThinkingBlockOf(item, classified.signature), [
        { field: 'encrypted_content', disposition: 'mapped', to: 'thinking.signature' },
      ]);
    case 'redacted':
      return {
        messages: [assistantWith(redactedThinkingBlockOf(classified.data))],
        fates: [{ field: 'encrypted_content', disposition: 'mapped', to: 'redacted_thinking' }],
      };
    case 'foreign':
      return keepOrDropThinking(thinkingBlockOf(item), [encryptedContentAbsent]);

    default: {
      const unhandled: never = classified;

      throw new Error(`unhandled reasoning signature: ${JSON.stringify(unhandled)}`);
    }
  }
}

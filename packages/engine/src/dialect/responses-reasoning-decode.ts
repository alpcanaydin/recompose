import type { Fate } from './fates';
import type { HubContentBlock, HubMessage } from './hub';
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

function foldForeignReasoning(item: ResponsesReasoningItem): FoldedReasoning {
  const fates: Fate[] = [{ field: 'encrypted_content', disposition: 'mapped', to: 'absent' }];
  const thinking = thinkingBlockOf(item);

  if (thinking.text.length === 0) {
    return { messages: [], fates };
  }

  return { messages: [assistantWith(thinking)], fates };
}

export function foldReasoning(item: ResponsesReasoningItem): FoldedReasoning {
  const classified = classifyReasoningSignature(item.encrypted_content);

  switch (classified.kind) {
    case 'none':
      return { messages: [assistantWith(thinkingBlockOf(item))], fates: [] };
    case 'compatible':
      return {
        messages: [assistantWith(signedThinkingBlockOf(item, classified.signature))],
        fates: [{ field: 'encrypted_content', disposition: 'mapped', to: 'thinking.signature' }],
      };
    case 'redacted':
      return {
        messages: [assistantWith(redactedThinkingBlockOf(classified.data))],
        fates: [{ field: 'encrypted_content', disposition: 'mapped', to: 'redacted_thinking' }],
      };
    case 'foreign':
      return foldForeignReasoning(item);

    default: {
      const unhandled: never = classified;

      throw new Error(`unhandled reasoning signature: ${JSON.stringify(unhandled)}`);
    }
  }
}

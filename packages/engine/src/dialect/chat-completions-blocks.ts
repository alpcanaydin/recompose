import type { ChatToolCall } from './chat-completions-wire';
import type { Fate } from './fates';
import type {
  HubContentBlock,
  HubImageBlock,
  HubTextBlock,
  HubToolResultBlock,
  HubToolUseBlock,
} from './hub';

import { parseToolArguments } from './hub-build';
import { sanitizeToolId } from './tool-id';

export function hubToolUseFromChatCall(call: ChatToolCall): HubToolUseBlock {
  return {
    type: 'tool_use',
    id: sanitizeToolId(call.id),
    name: call.function.name,
    input: parseToolArguments(call.function.arguments),
  };
}

function chatCallFromHubToolUse(block: HubToolUseBlock): ChatToolCall {
  return {
    id: block.id,
    type: 'function',
    function: { name: block.name, arguments: JSON.stringify(block.input) },
  };
}

export function droppedThinking(fates: Fate[]): void {
  fates.push({ field: 'thinking', disposition: 'mapped', to: 'absent', costBearing: true });
}

export function droppedRedactedThinking(fates: Fate[]): void {
  fates.push({
    field: 'redacted_thinking',
    disposition: 'mapped',
    to: 'absent',
    costBearing: true,
  });
}

function routeAssistantContentBlock(
  block: HubTextBlock | HubImageBlock | HubToolUseBlock | HubToolResultBlock,
  texts: string[],
  toolCalls: ChatToolCall[],
  fates: Fate[],
): void {
  switch (block.type) {
    case 'text':
      texts.push(block.text);

      return;
    case 'tool_use':
      toolCalls.push(chatCallFromHubToolUse(block));

      return;
    case 'image':
      fates.push({ field: 'image', disposition: 'mapped', to: 'absent' });

      return;
    case 'tool_result':
      fates.push({ field: 'tool_result', disposition: 'mapped', to: 'absent' });

      return;

    default: {
      const unknownBlock: never = block;

      throw new Error(
        `an assistant block has no Chat Completions form: ${JSON.stringify(unknownBlock)}`,
      );
    }
  }
}

function routeAssistantBlock(
  block: HubContentBlock,
  texts: string[],
  toolCalls: ChatToolCall[],
  fates: Fate[],
): void {
  if (block.type === 'thinking') {
    droppedThinking(fates);

    return;
  }

  if (block.type === 'redacted_thinking') {
    droppedRedactedThinking(fates);

    return;
  }

  routeAssistantContentBlock(block, texts, toolCalls, fates);
}

export function foldAssistantBlocks(
  content: readonly HubContentBlock[],
  fates: Fate[],
): { text: string | null; toolCalls: ChatToolCall[] } {
  const texts: string[] = [];
  const toolCalls: ChatToolCall[] = [];

  for (const block of content) {
    routeAssistantBlock(block, texts, toolCalls, fates);
  }

  return { text: texts.length > 0 ? texts.join('') : null, toolCalls };
}

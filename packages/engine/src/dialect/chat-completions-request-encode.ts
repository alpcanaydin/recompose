import type {
  ChatAssistantMessage,
  ChatCompletionsRequest,
  ChatContentPart,
  ChatMessage,
  ChatToolMessage,
} from './chat-completions-wire';
import type { Fate, Translated } from './fates';
import type {
  HubContentBlock,
  HubImageBlock,
  HubMessage,
  HubRequest,
  HubTextBlock,
  HubToolResultBlock,
  HubToolUseBlock,
} from './hub';

import { droppedThinking, foldAssistantBlocks } from './chat-completions-blocks';
import { systemMessageFrom } from './chat-completions-request-fields';
import {
  chatSamplingInto,
  chatToolChoiceInto,
  chatToolsInto,
} from './chat-completions-request-fields-encode';

function imageUrl(block: HubImageBlock): string {
  const source = block.source;

  if (source.type === 'url') {
    return source.url;
  }

  return `data:${source.mediaType};base64,${source.data}`;
}

function chatAssistantFromHub(message: HubMessage, fates: Fate[]): ChatAssistantMessage {
  const { text, toolCalls } = foldAssistantBlocks(message.content, fates);

  return {
    role: 'assistant',
    content: text,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

function toolResultText(block: HubToolResultBlock): string {
  return block.content.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

function chatToolMessageFrom(block: HubToolResultBlock): ChatToolMessage {
  return { role: 'tool', tool_call_id: block.toolUseId, content: toolResultText(block) };
}

function routeUserContentBlock(
  block: HubTextBlock | HubImageBlock | HubToolUseBlock | HubToolResultBlock,
  parts: ChatContentPart[],
  fates: Fate[],
): void {
  switch (block.type) {
    case 'text':
      parts.push({ type: 'text', text: block.text });

      return;
    case 'image':
      parts.push({ type: 'image_url', image_url: { url: imageUrl(block) } });

      return;
    case 'tool_use':
      fates.push({ field: 'tool_use', disposition: 'mapped', to: 'absent' });

      return;
    case 'tool_result':
      return;

    default: {
      const unknownBlock: never = block;

      throw new Error(`encodeRequest met an unknown user block: ${JSON.stringify(unknownBlock)}`);
    }
  }
}

function routeUserBlock(block: HubContentBlock, parts: ChatContentPart[], fates: Fate[]): void {
  if (block.type === 'thinking') {
    droppedThinking(fates);

    return;
  }

  routeUserContentBlock(block, parts, fates);
}

function userContent(parts: readonly ChatContentPart[]): string | readonly ChatContentPart[] {
  if (parts.some((part) => part.type === 'image_url')) {
    return parts;
  }

  return parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

function chatUserFromHub(message: HubMessage, fates: Fate[]): ChatMessage[] {
  const toolResults = message.content.filter(
    (block): block is HubToolResultBlock => block.type === 'tool_result',
  );

  if (toolResults.length > 0) {
    return toolResults.map(chatToolMessageFrom);
  }

  const parts: ChatContentPart[] = [];

  for (const block of message.content) {
    routeUserBlock(block, parts, fates);
  }

  return [{ role: 'user', content: userContent(parts) }];
}

function chatMessagesFromHub(message: HubMessage, fates: Fate[]): ChatMessage[] {
  if (message.role === 'assistant') {
    return [chatAssistantFromHub(message, fates)];
  }

  return chatUserFromHub(message, fates);
}

export function encodeRequest(hub: HubRequest): Translated<ChatCompletionsRequest> {
  const fates: Fate[] = [];
  const messages: ChatMessage[] = [];
  const system = systemMessageFrom(hub.system, fates);

  if (system !== undefined) {
    messages.push(system);
  }

  for (const message of hub.messages) {
    messages.push(...chatMessagesFromHub(message, fates));
  }

  const request: ChatCompletionsRequest = {
    messages,
    ...chatToolsInto(hub, fates),
    ...chatToolChoiceInto(hub, fates),
    ...chatSamplingInto(hub, fates),
  };

  return { value: request, fates };
}

import type {
  ChatAssistantMessage,
  ChatCacheControl,
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
  HubToolResultBlock,
} from './hub';

import { dropChatBlock, foldAssistantBlocks, isDroppedChatBlock } from './chat-completions-blocks';
import { chatCacheControlFrom } from './chat-completions-cache';
import { chatPartFromHubMedia, isHubChatMedia } from './chat-completions-media';
import { systemMessageFrom } from './chat-completions-request-fields';
import {
  chatSamplingInto,
  chatToolChoiceInto,
  chatToolsInto,
} from './chat-completions-request-fields-encode';
import { chatOptionsInto } from './chat-completions-request-options';
import { isCodexReasoningSignature } from './responses-shared';

function imageUrl(block: HubImageBlock): string {
  const source = block.source;

  if (source.type === 'url') {
    return source.url;
  }

  return `data:${source.mediaType};base64,${source.data}`;
}

function chatAssistantFromHub(
  message: HubMessage,
  fates: Fate[],
  preserveIncompatibleReasoning: boolean,
): ChatAssistantMessage {
  const { text, toolCalls } = foldAssistantBlocks(message.content, fates);
  const reasoning = assistantReasoning(message, preserveIncompatibleReasoning);

  return {
    role: 'assistant',
    content: assistantContent(message, text),
    ...(reasoning === undefined ? {} : { reasoning_content: reasoning }),
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

function assistantReasoning(
  message: HubMessage,
  preserveIncompatibleReasoning: boolean,
): string | undefined {
  const reasoning = message.content
    .flatMap((block) =>
      block.type === 'thinking' && carriesReasoning(block.signature, preserveIncompatibleReasoning)
        ? [block.text]
        : [],
    )
    .join('\n');

  return reasoning.trim() === '' ? undefined : reasoning;
}

function carriesReasoning(signature: string | undefined, preserve: boolean): boolean {
  if (preserve && (signature === '' || signature === undefined)) return true;

  return isCodexReasoningSignature(signature);
}

function assistantContent(
  message: HubMessage,
  fallback: string | null,
): string | readonly ChatContentPart[] | null {
  const texts = message.content.flatMap((block) =>
    block.type === 'text' ? [{ type: 'text' as const, text: block.text }] : [],
  );

  return texts.length > 1 ? texts : fallback;
}

function toolResultText(block: HubToolResultBlock): string {
  return block.content.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

function chatToolMessageFrom(block: HubToolResultBlock, fates: Fate[]): ChatToolMessage {
  return {
    role: 'tool',
    tool_call_id: block.toolUseId,
    content: chatToolResultContent(block, fates),
  };
}

function chatToolResultContent(
  block: HubToolResultBlock,
  _fates: Fate[],
): ChatToolMessage['content'] {
  const hasImage = block.content.some((part) => part.type === 'image');

  if (block.structuredResult !== undefined && !hasImage) {
    return JSON.stringify(block.structuredResult);
  }

  const parts = block.content.map(
    (part): ChatContentPart =>
      part.type === 'text'
        ? { type: 'text', text: part.text }
        : {
            type: 'image_url',
            image_url: {
              url: imageUrl(part),
              ...(part.detail === undefined ? {} : { detail: part.detail }),
            },
          },
  );

  return parts.some((part) => part.type !== 'text') ? parts : toolResultText(block);
}

function routeUserContentBlock(
  block: Exclude<HubContentBlock, { type: 'thinking' | 'redacted_thinking' }>,
  parts: ChatContentPart[],
  fates: Fate[],
): void {
  if (isHubChatMedia(block)) {
    const part = chatPartFromHubMedia(block);

    if (part !== null) parts.push(part);

    return;
  }

  routeBasicUserBlock(block, parts, fates);
}

function routeBasicUserBlock(
  block: Exclude<
    HubContentBlock,
    { type: 'thinking' | 'redacted_thinking' | 'audio' | 'video' | 'document' }
  >,
  parts: ChatContentPart[],
  fates: Fate[],
): void {
  if (block.type === 'tool_result') return;

  if (block.type === 'tool_use') {
    fates.push({ field: 'tool_use', disposition: 'mapped', to: 'absent' });

    return;
  }

  if (block.type === 'text') {
    parts.push({
      type: 'text',
      text: block.text,
      ...chatCacheControlFrom(block.cacheBreakpoint),
    });

    return;
  }

  parts.push({
    type: 'image_url',
    image_url: {
      url: imageUrl(block),
      ...(block.detail === undefined ? {} : { detail: block.detail }),
    },
  });
}

function routeUserBlock(block: HubContentBlock, parts: ChatContentPart[], fates: Fate[]): void {
  if (isDroppedChatBlock(block)) {
    dropChatBlock(block, fates, true);

    return;
  }

  routeUserContentBlock(block, parts, fates);
}

function userContent(parts: readonly ChatContentPart[]): string | readonly ChatContentPart[] {
  if (parts.length > 1 || parts.some((part) => part.type !== 'text')) {
    return parts;
  }

  return parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

function collapsedCacheControl(
  content: string | readonly ChatContentPart[],
  parts: readonly ChatContentPart[],
): { cache_control?: ChatCacheControl } {
  if (typeof content !== 'string') {
    return {};
  }

  const control = parts.find(hasCacheControl)?.cache_control;

  return control === undefined ? {} : { cache_control: control };
}

function hasCacheControl(
  part: ChatContentPart,
): part is Extract<ChatContentPart, { type: 'text' | 'image_url' }> {
  return part.type === 'text' || part.type === 'image_url';
}

function chatUserFromHub(message: HubMessage, fates: Fate[]): ChatMessage[] {
  const toolResults = message.content.filter(
    (block): block is HubToolResultBlock => block.type === 'tool_result',
  );
  const toolMessages = toolResults.map((block) => chatToolMessageFrom(block, fates));
  const parts: ChatContentPart[] = [];

  for (const block of message.content) {
    routeUserBlock(block, parts, fates);
  }

  if (parts.length === 0) {
    return toolMessages;
  }

  const content = userContent(parts);

  return [...toolMessages, { role: 'user', content, ...collapsedCacheControl(content, parts) }];
}

function chatMessagesFromHub(
  message: HubMessage,
  fates: Fate[],
  preserveIncompatibleReasoning: boolean,
): ChatMessage[] {
  if (message.role === 'assistant') {
    const assistant = chatAssistantFromHub(message, fates, preserveIncompatibleReasoning);

    return hasAssistantPayload(assistant) ? [assistant] : [];
  }

  return chatUserFromHub(message, fates);
}

function hasAssistantPayload(message: ChatAssistantMessage): boolean {
  if (message.reasoning_content !== undefined) return true;
  if (hasToolCalls(message)) return true;

  return hasContent(message.content);
}

function hasToolCalls(message: ChatAssistantMessage): boolean {
  return message.tool_calls !== undefined && message.tool_calls.length > 0;
}

function hasContent(content: ChatAssistantMessage['content']): boolean {
  if (typeof content === 'string') return content !== '';

  return Array.isArray(content) && content.length > 0;
}

function encodeRequestInternal(
  hub: HubRequest,
  preserveIncompatibleReasoning: boolean,
): Translated<ChatCompletionsRequest> {
  const fates: Fate[] = [];
  const messages: ChatMessage[] = [];
  const system = systemMessageFrom(hub.system, fates);

  if (system !== undefined) {
    messages.push(system);
  }

  for (const message of hub.messages) {
    messages.push(...chatMessagesFromHub(message, fates, preserveIncompatibleReasoning));
  }

  const request: ChatCompletionsRequest = {
    messages,
    ...chatToolsInto(hub, fates),
    ...chatToolChoiceInto(hub, fates),
    ...chatSamplingInto(hub, fates),
  };

  chatOptionsInto(request, hub, fates);

  return { value: request, fates };
}

export function encodeRequest(hub: HubRequest): Translated<ChatCompletionsRequest> {
  return encodeRequestInternal(hub, true);
}

export function encodeRequestWithCompat(hub: HubRequest): Translated<ChatCompletionsRequest> {
  return encodeRequestInternal(hub, true);
}

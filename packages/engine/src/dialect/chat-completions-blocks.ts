import type { ChatToolCall } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubContentBlock, HubToolUseBlock } from './hub';

import { geminiReplaySignature } from '../provider/gemini-signature';
import { parseToolArguments } from './hub-build';
import { sanitizeToolId } from './tool-id';

function googleThoughtSignature(
  extra: { google?: { thought_signature?: string } } | undefined,
): string | undefined {
  return extra?.google?.thought_signature;
}

function chatToolSignature(call: ChatToolCall): string | undefined {
  const candidates = [
    googleThoughtSignature(call.extra_content),
    googleThoughtSignature(call.function.extra_content),
    call.thoughtSignature,
    call.thought_signature,
  ];

  return candidates.find((value): value is string => typeof value === 'string');
}

export function hubToolUseFromChatCall(call: ChatToolCall): HubToolUseBlock {
  const signature = chatToolSignature(call);

  return {
    type: 'tool_use',
    id: sanitizeToolId(call.id),
    name: call.function.name,
    input: parseToolArguments(call.function.arguments),
    ...(signature === undefined ? {} : { signature: geminiReplaySignature(signature) }),
  };
}

function chatCallFromHubToolUse(block: HubToolUseBlock): ChatToolCall {
  return {
    id: block.id,
    type: 'function',
    function: { name: block.name, arguments: JSON.stringify(block.input) },
    ...(block.signature === undefined
      ? {}
      : { extra_content: { google: { thought_signature: `gemini#${block.signature}` } } }),
  };
}

function droppedThinking(fates: Fate[]): void {
  fates.push({ field: 'thinking', disposition: 'mapped', to: 'absent', costBearing: true });
}

function droppedRedactedThinking(fates: Fate[]): void {
  fates.push({
    field: 'redacted_thinking',
    disposition: 'mapped',
    to: 'absent',
    costBearing: true,
  });
}

type DroppedChatBlock = Extract<HubContentBlock, { type: 'thinking' | 'redacted_thinking' }>;

export function isDroppedChatBlock(block: HubContentBlock): block is DroppedChatBlock {
  return ['thinking', 'redacted_thinking'].includes(block.type);
}

export function dropChatBlock(
  block: DroppedChatBlock,
  fates: Fate[],
  _documentCostBearing: boolean,
): void {
  if (block.type === 'thinking') {
    droppedThinking(fates);

    return;
  }

  droppedRedactedThinking(fates);
}

function routeAssistantContentBlock(
  block: Exclude<HubContentBlock, { type: 'thinking' | 'redacted_thinking' }>,
  texts: string[],
  toolCalls: ChatToolCall[],
  fates: Fate[],
): void {
  if (block.type === 'text') {
    texts.push(block.text);

    return;
  }

  if (block.type === 'tool_use') {
    toolCalls.push(chatCallFromHubToolUse(block));

    return;
  }

  if (block.type === 'tool_result') {
    fates.push({ field: 'tool_result', disposition: 'mapped', to: 'absent' });

    return;
  }

  fates.push({
    field: block.type,
    disposition: 'mapped',
    to: 'absent',
    ...(block.type === 'image' ? {} : { costBearing: true }),
  });
}

function routeAssistantBlock(
  block: HubContentBlock,
  texts: string[],
  toolCalls: ChatToolCall[],
  fates: Fate[],
): void {
  if (isDroppedChatBlock(block)) {
    dropChatBlock(block, fates, false);

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

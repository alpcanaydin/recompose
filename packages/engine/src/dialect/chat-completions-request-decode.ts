import type { TranslationRefusal } from '../refusals';
import type {
  ChatAssistantMessage,
  ChatCompletionsRequest,
  ChatContentPart,
  ChatMessage,
  ChatToolCall,
  ChatToolMessage,
  ChatUserMessage,
} from './chat-completions-wire';
import type { Fate, TranslateResult } from './fates';
import type { HubContentBlock, HubMessage, HubRequest, HubToolResultBlock } from './hub';

import { unrepairableToolCall } from '../refusals';
import { hubToolUseFromChatCall } from './chat-completions-blocks';
import {
  samplingFrom,
  scanDrops,
  scanEnvelope,
  systemFrom,
  toolChoiceFrom,
  toolsFrom,
} from './chat-completions-request-fields';

type DecodeAcc = {
  systemTexts: string[];
  messages: HubMessage[];
  fates: Fate[];
};

function collectCallIds(message: ChatMessage, callIds: Set<string>): void {
  if (message.role !== 'assistant') {
    return;
  }

  for (const call of message.tool_calls ?? []) {
    callIds.add(call.id);
  }
}

function callAndResultIds(messages: readonly ChatMessage[]): {
  callIds: Set<string>;
  resultIds: Set<string>;
} {
  const callIds = new Set<string>();
  const resultIds = new Set<string>();

  for (const message of messages) {
    collectCallIds(message, callIds);

    if (message.role === 'tool') {
      resultIds.add(message.tool_call_id);
    }
  }

  return { callIds, resultIds };
}

function orphanResultId(callIds: Set<string>, resultIds: Set<string>): string | undefined {
  for (const id of resultIds) {
    if (!callIds.has(id)) {
      return id;
    }
  }

  return undefined;
}

function textBlock(text: string, fates: Fate[]): readonly HubContentBlock[] {
  if (text === '') {
    fates.push({ field: 'content', disposition: 'mapped', to: 'absent' });

    return [];
  }

  return [{ type: 'text', text }];
}

function partBlock(part: ChatContentPart, fates: Fate[]): readonly HubContentBlock[] {
  if (part.type === 'text') {
    return textBlock(part.text, fates);
  }

  return [{ type: 'image', source: { type: 'url', url: part.image_url.url } }];
}

function userBlocks(message: ChatUserMessage, fates: Fate[]): readonly HubContentBlock[] {
  if (typeof message.content === 'string') {
    return textBlock(message.content, fates);
  }

  return message.content.flatMap((part) => partBlock(part, fates));
}

function foldUserMessage(message: ChatUserMessage, acc: DecodeAcc): void {
  const blocks = userBlocks(message, acc.fates);

  if (blocks.length > 0) {
    acc.messages.push({ role: 'user', content: blocks });
  }
}

function routeToolCall(
  call: ChatToolCall,
  blocks: HubContentBlock[],
  fates: Fate[],
  answered: Set<string>,
): void {
  if (answered.has(call.id)) {
    blocks.push(hubToolUseFromChatCall(call));

    return;
  }

  fates.push({ field: call.id, disposition: 'mapped', to: 'absent' });
}

function assistantText(content: string | null | undefined): string | undefined {
  if (typeof content === 'string' && content !== '') {
    return content;
  }

  return undefined;
}

function foldAssistantMessage(
  message: ChatAssistantMessage,
  acc: DecodeAcc,
  answered: Set<string>,
): void {
  const blocks: HubContentBlock[] = [];
  const text = assistantText(message.content);

  if (text !== undefined) {
    blocks.push({ type: 'text', text });
  }

  for (const call of message.tool_calls ?? []) {
    routeToolCall(call, blocks, acc.fates, answered);
  }

  if (blocks.length > 0) {
    acc.messages.push({ role: 'assistant', content: blocks });
  }
}

function foldToolMessage(message: ChatToolMessage, acc: DecodeAcc): void {
  const block: HubToolResultBlock = {
    type: 'tool_result',
    toolUseId: message.tool_call_id,
    content: [{ type: 'text', text: message.content }],
  };

  acc.messages.push({ role: 'user', content: [block] });
}

function foldTurnMessage(
  message: ChatUserMessage | ChatAssistantMessage | ChatToolMessage,
  acc: DecodeAcc,
  answered: Set<string>,
): void {
  switch (message.role) {
    case 'user':
      foldUserMessage(message, acc);

      return;
    case 'assistant':
      foldAssistantMessage(message, acc, answered);

      return;
    case 'tool':
      foldToolMessage(message, acc);

      return;

    default: {
      const unknownRole: never = message;

      throw new Error(`decodeRequest met an unknown message role: ${JSON.stringify(unknownRole)}`);
    }
  }
}

function foldMessage(message: ChatMessage, acc: DecodeAcc, answered: Set<string>): void {
  if (message.role === 'system' || message.role === 'developer') {
    acc.systemTexts.push(message.content);

    return;
  }

  foldTurnMessage(message, acc, answered);
}

function assembleHubRequest(request: ChatCompletionsRequest, acc: DecodeAcc): HubRequest {
  const system = systemFrom(acc.systemTexts);
  const tools = toolsFrom(request, acc.fates);
  const toolChoice = toolChoiceFrom(request, acc.fates);

  return {
    ...(system ? { system } : {}),
    messages: acc.messages,
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    sampling: samplingFrom(request, acc.fates),
  };
}

export function decodeRequest(
  request: ChatCompletionsRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  const { callIds, resultIds } = callAndResultIds(request.messages);
  const orphan = orphanResultId(callIds, resultIds);

  if (orphan !== undefined) {
    return { refusal: unrepairableToolCall(orphan) };
  }

  const acc: DecodeAcc = { systemTexts: [], messages: [], fates: [] };

  for (const message of request.messages) {
    foldMessage(message, acc, resultIds);
  }

  scanEnvelope(request, acc.fates);
  scanDrops(request, acc.fates);

  return { value: assembleHubRequest(request, acc), fates: acc.fates };
}

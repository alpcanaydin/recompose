import type { TranslationRefusal } from '../refusals';
import type {
  ChatAssistantMessage,
  ChatCompletionsRequest,
  ChatMessage,
  ChatToolCall,
  ChatToolMessage,
  ChatUserMessage,
} from './chat-completions-wire';
import type { Fate, TranslateResult } from './fates';
import type { HubCacheBreakpoint, HubContentBlock, HubMessage, HubRequest } from './hub';

import { emptyConversation, toolIdCollision, unrepairableToolCall } from '../refusals';
import { hubToolUseFromChatCall } from './chat-completions-blocks';
import { hubBreakpointFrom } from './chat-completions-cache';
import {
  samplingFrom,
  scanDrops,
  scanEnvelope,
  systemFrom,
  toolChoiceFrom,
  toolsFrom,
} from './chat-completions-request-fields';
import { toolResultBlockFrom } from './chat-completions-tool-result';
import { userBlocks } from './chat-completions-user-decode';
import { mergeAdjacentSameRole } from './hub-build';
import { firstToolIdCollision } from './tool-id';

type DecodeAcc = {
  systemTexts: string[];
  systemBreakpoint: HubCacheBreakpoint | undefined;
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

function foldTurnMessage(
  message: ChatUserMessage | ChatAssistantMessage,
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

    default: {
      const unknownRole: never = message;

      throw new Error(`decodeRequest met an unknown message role: ${JSON.stringify(unknownRole)}`);
    }
  }
}

function foldNonToolMessage(
  message: Exclude<ChatMessage, ChatToolMessage>,
  acc: DecodeAcc,
  answered: Set<string>,
): void {
  if (message.role === 'system' || message.role === 'developer') {
    acc.systemTexts.push(message.content);

    if (message.cache_control !== undefined) {
      acc.systemBreakpoint = hubBreakpointFrom(message.cache_control);
    }

    return;
  }

  foldTurnMessage(message, acc, answered);
}

function foldToolRun(messages: readonly ChatMessage[], start: number, acc: DecodeAcc): number {
  const blocks: HubContentBlock[] = [];
  let index = start;

  while (index < messages.length) {
    const message = messages[index];

    if (message?.role !== 'tool') {
      break;
    }

    blocks.push(toolResultBlockFrom(message));
    index += 1;
  }

  acc.messages.push({ role: 'user', content: blocks });

  return index;
}

function foldMessages(
  messages: readonly ChatMessage[],
  acc: DecodeAcc,
  answered: Set<string>,
): void {
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];

    if (message === undefined) {
      break;
    }

    if (message.role === 'tool') {
      index = foldToolRun(messages, index, acc);
    } else {
      foldNonToolMessage(message, acc, answered);
      index += 1;
    }
  }
}

function assembleHubRequest(request: ChatCompletionsRequest, acc: DecodeAcc): HubRequest {
  const system = systemFrom(acc.systemTexts, acc.systemBreakpoint);
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

  const collision = firstToolIdCollision([...callIds, ...resultIds]);

  if (collision !== undefined) {
    return { refusal: toolIdCollision(collision) };
  }

  const acc: DecodeAcc = {
    systemTexts: [],
    systemBreakpoint: undefined,
    messages: [],
    fates: [],
  };

  foldMessages(request.messages, acc, resultIds);
  acc.messages = mergeAdjacentSameRole(acc.messages);

  if (acc.messages.length === 0) {
    return { refusal: emptyConversation() };
  }

  scanEnvelope(request, acc.fates);
  scanDrops(request, acc.fates);

  return { value: assembleHubRequest(request, acc), fates: acc.fates };
}

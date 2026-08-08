import type { TranslationRefusal } from '../refusals';
import type {
  ChatAssistantMessage,
  ChatCompletionsRequest,
  ChatContentPart,
  ChatMessage,
  ChatCustomToolCall,
  ChatToolCall,
  ChatToolMessage,
  ChatUserMessage,
} from './chat-completions-wire';
import type { Fate, TranslateResult } from './fates';
import type { HubCacheBreakpoint, HubContentBlock, HubMessage, HubRequest } from './hub';

import { emptyConversation } from '../refusals';
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
import { hubOptionsFromChat } from './chat-completions-request-options';
import { chatRequestViolation } from './chat-completions-request-validation';
import { chatSystemTexts } from './chat-completions-system-content';
import { toolResultBlockFrom } from './chat-completions-tool-result';
import { userBlocks } from './chat-completions-user-decode';
import { mergeAdjacentSameRole } from './hub-build';

type DecodeAcc = {
  request: ChatCompletionsRequest;
  systemTexts: string[];
  systemBreakpoint: HubCacheBreakpoint | undefined;
  messages: HubMessage[];
  fates: Fate[];
  preserveReasoning: boolean;
  toolFamilies: Map<string, 'function' | 'custom'>;
};

function declaredFamily(request: ChatCompletionsRequest, name: string): 'function' | 'custom' {
  const tools = request.tools ?? [];

  if (tools.some((tool) => tool.type === 'function' && String(tool.function.name) === name))
    return 'function';

  return tools.some((tool) => tool.type === 'custom' && tool.name === name) ? 'custom' : 'function';
}

function foldUserMessage(message: ChatUserMessage, acc: DecodeAcc): void {
  const blocks = userBlocks(message, acc.fates);

  if (blocks.length > 0) {
    acc.messages.push({ role: 'user', content: blocks });
  }
}

function routeToolCall(
  call: ChatToolCall | ChatCustomToolCall,
  blocks: HubContentBlock[],
  fates: Fate[],
  answered: Set<string>,
  family: 'function' | 'custom',
): void {
  const id = call.id ?? 'call_missing';

  if (answered.has(id)) {
    blocks.push(hubToolUseFromChatCall(call, family));

    return;
  }

  fates.push({ field: id, disposition: 'mapped', to: 'absent' });
}

function assistantText(content: ChatAssistantMessage['content']): string | undefined {
  if (typeof content === 'string' && content !== '') {
    return content;
  }

  if (isChatContent(content)) {
    const text = content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');

    return text === '' ? undefined : text;
  }

  return undefined;
}

function isChatContent(value: unknown): value is readonly ChatContentPart[] {
  return Array.isArray(value);
}

function reasoningBlocks(message: ChatAssistantMessage, preserve: boolean): HubContentBlock[] {
  return preserve && message.reasoning_content !== undefined
    ? [{ type: 'thinking', text: message.reasoning_content, signature: '' }]
    : [];
}

function answerBlocks(message: ChatAssistantMessage): HubContentBlock[] {
  const text = assistantText(message.content);

  return text === undefined ? [] : [{ type: 'text', text }];
}

function foldAssistantMessage(
  message: ChatAssistantMessage,
  acc: DecodeAcc,
  answered: Set<string>,
): void {
  const blocks: HubContentBlock[] = [
    ...reasoningBlocks(message, acc.preserveReasoning),
    ...answerBlocks(message),
  ];

  for (const call of message.tool_calls ?? []) foldAssistantCall(call, acc, answered, blocks);

  if (blocks.length > 0) {
    acc.messages.push({ role: 'assistant', content: blocks });
  }
}

function foldAssistantCall(
  call: ChatToolCall | ChatCustomToolCall,
  acc: DecodeAcc,
  answered: Set<string>,
  blocks: HubContentBlock[],
): void {
  const name = call.type === 'custom' ? call.custom.name : call.function.name;
  const family = call.type === 'custom' ? 'custom' : declaredFamily(acc.request, name);

  acc.toolFamilies.set(call.id ?? 'call_missing', family);
  routeToolCall(call, blocks, acc.fates, answered, family);
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
    acc.systemTexts.push(...chatSystemTexts(message.content));

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

    blocks.push(toolResultWithFamily(message, acc));
    index += 1;
  }

  acc.messages.push({ role: 'user', content: blocks });

  return index;
}

function toolResultWithFamily(message: ChatToolMessage, acc: DecodeAcc): HubContentBlock {
  const block = toolResultBlockFrom(message);
  const family = acc.toolFamilies.get(message.tool_call_id ?? 'call_missing');

  return family === undefined ? block : { ...block, family };
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
    ...hubOptionsFromChat(request, acc.fates),
  };
}

function finalizeMessages(acc: DecodeAcc): void {
  if (acc.messages.length === 0 && acc.systemTexts.length > 0) {
    acc.messages.push({ role: 'user', content: [{ type: 'text', text: '' }] });
  }

  acc.messages = mergeAdjacentSameRole(acc.messages);
}

export function decodeRequest(
  request: ChatCompletionsRequest,
  preserveReasoning = false,
): TranslateResult<HubRequest, TranslationRefusal> {
  const validation = chatRequestViolation(request.messages);

  if (validation.refusal !== undefined) return { refusal: validation.refusal };

  const acc: DecodeAcc = {
    systemTexts: [],
    systemBreakpoint: undefined,
    messages: [],
    fates: [],
    preserveReasoning,
    toolFamilies: new Map(),
    request,
  };

  foldMessages(request.messages, acc, validation.resultIds);
  finalizeMessages(acc);

  if (acc.messages.length === 0) {
    return { refusal: emptyConversation() };
  }

  scanEnvelope(request, acc.fates);
  scanDrops(request, acc.fates);

  return { value: assembleHubRequest(request, acc), fates: acc.fates };
}

export function decodeRequestWithCompat(
  request: ChatCompletionsRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  return decodeRequest(request, true);
}

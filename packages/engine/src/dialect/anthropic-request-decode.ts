import type { TranslationRefusal } from '../refusals';
import type { AnthropicContentBlock, AnthropicMessage, AnthropicRequest } from './anthropic-wire';
import type { Fate, TranslateResult } from './fates';
import type { HubContentBlock, HubMessage, HubRequest } from './hub';

import { emptyConversation } from '../refusals';
import { hubBlockFrom } from './anthropic-blocks';
import {
  parallelToolCallsFrom,
  reasoningFrom,
  samplingFrom,
  scanDrops,
  scanEnvelope,
  serverToolsFrom,
  serviceTierFrom,
  systemFrom,
  toolChoiceFrom,
  toolsFrom,
} from './anthropic-request-fields';
import { mergeAdjacentSameRole } from './hub-build';

function emptyTextFate(fates: Fate[]): readonly HubContentBlock[] {
  fates.push({ field: 'content', disposition: 'mapped', to: 'absent' });

  return [];
}

function hubBlocksOf(
  block: AnthropicContentBlock,
  fates: Fate[],
  preserveEmptyThinking: boolean,
): readonly HubContentBlock[] {
  if (dropsEmptyBlock(block, preserveEmptyThinking)) {
    return emptyTextFate(fates);
  }

  return [hubBlockFrom(block, fates)];
}

function dropsEmptyBlock(block: AnthropicContentBlock, preserveEmptyThinking: boolean): boolean {
  if (block.type === 'text') return block.text === '';
  if (block.type !== 'thinking' || preserveEmptyThinking) return false;

  return block.signature === '' || emptyUnsignedThinking(block);
}

function emptyUnsignedThinking(
  block: Extract<AnthropicContentBlock, { type: 'thinking' }>,
): boolean {
  return block.thinking === '' && block.signature === undefined;
}

function hubContentFrom(
  message: AnthropicMessage,
  fates: Fate[],
  preserveEmptyThinking: boolean,
): readonly HubContentBlock[] {
  if (typeof message.content === 'string') {
    return message.content === ''
      ? emptyTextFate(fates)
      : [{ type: 'text', text: message.content }];
  }

  return message.content.flatMap((block) => hubBlocksOf(block, fates, preserveEmptyThinking));
}

function hubMessagesFrom(
  messages: readonly AnthropicMessage[],
  fates: Fate[],
  preserveEmptyThinking: boolean,
): HubMessage[] {
  const folded: HubMessage[] = [];

  for (const message of messages) {
    const content = hubContentFrom(message, fates, preserveEmptyThinking);

    if (content.length > 0) {
      folded.push(hubMessageFrom(message, content));
    }
  }

  return mergeAdjacentSameRole(folded);
}

function hubMessageFrom(
  message: AnthropicMessage,
  content: readonly HubContentBlock[],
): HubMessage {
  if (message.role !== 'system') return { role: message.role, content };

  return {
    role: 'user',
    content: systemReminderContent(content),
    boundary: 'system-reminder',
  };
}

function systemReminderContent(content: readonly HubContentBlock[]): readonly HubContentBlock[] {
  return content.map((block) =>
    block.type === 'text'
      ? { ...block, text: `<system-reminder>\n${block.text}\n</system-reminder>` }
      : block,
  );
}

function optionalRequestFields(
  system: HubRequest['system'],
  tools: HubRequest['tools'],
  toolChoice: HubRequest['toolChoice'],
): Partial<HubRequest> {
  return {
    ...(system === undefined ? {} : { system }),
    ...(tools === undefined ? {} : { tools }),
    ...(toolChoice === undefined ? {} : { toolChoice }),
  };
}

function subscriptionRequestFields(
  serverTools: HubRequest['serverTools'],
  parallelToolCalls: HubRequest['parallelToolCalls'],
  serviceTier: HubRequest['serviceTier'],
): Partial<HubRequest> {
  return {
    ...(serverTools === undefined ? {} : { serverTools }),
    ...(parallelToolCalls === undefined ? {} : { parallelToolCalls }),
    ...(serviceTier === undefined ? {} : { serviceTier }),
  };
}

export function decodeRequest(
  request: AnthropicRequest,
  preserveEmptyThinking = false,
): TranslateResult<HubRequest, TranslationRefusal> {
  const fates: Fate[] = [];
  const messages = hubMessagesFrom(request.messages, fates, preserveEmptyThinking);

  if (messages.length === 0) {
    return { refusal: emptyConversation() };
  }

  scanEnvelope(request, fates);
  scanDrops(request, fates);

  const system = systemFrom(request.system, fates);
  const tools = toolsFrom(request.tools, fates);
  const serverTools = serverToolsFrom(request.tools, fates);
  const toolChoice = toolChoiceFrom(request.tool_choice, fates, serverTools);
  const parallelToolCalls = parallelToolCallsFrom(request.tool_choice, fates);
  const serviceTier = serviceTierFrom(request, fates);
  const reasoning = reasoningFrom(request, fates);

  return {
    value: {
      ...optionalRequestFields(system, tools, toolChoice),
      ...subscriptionRequestFields(serverTools, parallelToolCalls, serviceTier),
      ...(reasoning === undefined ? {} : { reasoning }),
      messages,
      sampling: samplingFrom(request, fates),
    },
    fates,
  };
}

export function decodeRequestWithCompat(
  request: AnthropicRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  return decodeRequest(request, true);
}

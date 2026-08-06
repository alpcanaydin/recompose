import type { TranslationRefusal } from '../refusals';
import type { AnthropicContentBlock, AnthropicMessage, AnthropicRequest } from './anthropic-wire';
import type { Fate, TranslateResult } from './fates';
import type { HubContentBlock, HubMessage, HubRequest } from './hub';

import { emptyConversation } from '../refusals';
import { hubBlockFrom } from './anthropic-blocks';
import {
  samplingFrom,
  scanDrops,
  scanEnvelope,
  systemFrom,
  toolChoiceFrom,
  toolsFrom,
} from './anthropic-request-fields';
import { mergeAdjacentSameRole } from './hub-build';

function emptyTextFate(fates: Fate[]): readonly HubContentBlock[] {
  fates.push({ field: 'content', disposition: 'mapped', to: 'absent' });

  return [];
}

function hubBlocksOf(block: AnthropicContentBlock, fates: Fate[]): readonly HubContentBlock[] {
  if (block.type === 'text' && block.text === '') {
    return emptyTextFate(fates);
  }

  return [hubBlockFrom(block, fates)];
}

function hubContentFrom(message: AnthropicMessage, fates: Fate[]): readonly HubContentBlock[] {
  if (typeof message.content === 'string') {
    return message.content === ''
      ? emptyTextFate(fates)
      : [{ type: 'text', text: message.content }];
  }

  return message.content.flatMap((block) => hubBlocksOf(block, fates));
}

function hubMessagesFrom(messages: readonly AnthropicMessage[], fates: Fate[]): HubMessage[] {
  const folded: HubMessage[] = [];

  for (const message of messages) {
    const content = hubContentFrom(message, fates);

    if (content.length > 0) {
      folded.push({ role: message.role, content });
    }
  }

  return mergeAdjacentSameRole(folded);
}

export function decodeRequest(
  request: AnthropicRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  const fates: Fate[] = [];
  const messages = hubMessagesFrom(request.messages, fates);

  if (messages.length === 0) {
    return { refusal: emptyConversation() };
  }

  scanEnvelope(request, fates);
  scanDrops(request, fates);

  const system = systemFrom(request.system, fates);
  const tools = toolsFrom(request.tools, fates);
  const toolChoice = toolChoiceFrom(request.tool_choice, fates);

  return {
    value: {
      ...(system === undefined ? {} : { system }),
      messages,
      ...(tools === undefined ? {} : { tools }),
      ...(toolChoice === undefined ? {} : { toolChoice }),
      sampling: samplingFrom(request, fates),
    },
    fates,
  };
}

import type { TranslationRefusal } from '../refusals';
import type { ChatCompletionsResponse, ChatResponseMessage } from './chat-completions-wire';
import type { Fate, TranslateResult, Translated } from './fates';
import type { HubContentBlock, HubResponse } from './hub';

import { foldAssistantBlocks, hubToolUseFromChatCall } from './chat-completions-blocks';
import { chatFinishFrom, hubStopFrom } from './chat-completions-stops';
import { chatUsageFromHub, hubUsageFromChat } from './chat-completions-usage';

function hubContentFromMessage(message: ChatResponseMessage): readonly HubContentBlock[] {
  const blocks: HubContentBlock[] = [];

  if (typeof message.content === 'string' && message.content !== '') {
    blocks.push({ type: 'text', text: message.content });
  }

  for (const call of message.tool_calls ?? []) {
    blocks.push(hubToolUseFromChatCall(call));
  }

  return blocks;
}

export function decodeResponse(response: ChatCompletionsResponse): Translated<HubResponse> {
  const choice = response.choices[0];
  const fates: Fate[] = [
    { field: 'choices', disposition: 'mapped', to: 'content' },
    { field: 'usage', disposition: 'mapped', to: 'usage' },
  ];
  const content = choice ? hubContentFromMessage(choice.message) : [];
  const stopReason = choice ? hubStopFrom(choice.finish_reason) : 'end';

  return { value: { content, stopReason, usage: hubUsageFromChat(response.usage) }, fates };
}

function lossyFate(lossy: boolean, fates: Fate[]): void {
  if (lossy) {
    fates.push({ field: 'stopReason', disposition: 'mapped', to: 'finish_reason (lossy)' });
  }
}

export function encodeResponse(
  hub: HubResponse,
): TranslateResult<ChatCompletionsResponse, TranslationRefusal> {
  const finish = chatFinishFrom(hub.stopReason);

  if ('refusal' in finish) {
    return { refusal: finish.refusal };
  }

  const fates: Fate[] = [];

  lossyFate(finish.lossy, fates);

  const { text, toolCalls } = foldAssistantBlocks(hub.content, fates);
  const message: ChatResponseMessage = {
    role: 'assistant',
    content: text,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
  const response: ChatCompletionsResponse = {
    choices: [{ index: 0, message, finish_reason: finish.finish }],
    usage: chatUsageFromHub(hub.usage),
  };

  return { value: response, fates };
}

import type { TranslationRefusal } from '../refusals';
import type {
  ChatCompletionsResponse,
  ChatResponseMessage,
  ChatUsage,
} from './chat-completions-wire';
import type { Fate, TranslateResult, Translated } from './fates';
import type { HubContentBlock, HubResponse, HubUsage } from './hub';

import { foldAssistantBlocks, hubToolUseFromChatCall } from './chat-completions-blocks';
import { chatFinishFrom, hubStopFrom } from './chat-completions-stops';

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

function hubUsageFrom(usage: ChatUsage | undefined): HubUsage {
  if (usage === undefined) {
    return {};
  }

  return { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}

export function decodeResponse(response: ChatCompletionsResponse): Translated<HubResponse> {
  const choice = response.choices[0];
  const fates: Fate[] = [
    { field: 'choices', disposition: 'mapped', to: 'content' },
    { field: 'usage', disposition: 'mapped', to: 'usage' },
  ];
  const content = choice ? hubContentFromMessage(choice.message) : [];
  const stopReason = choice ? hubStopFrom(choice.finish_reason) : 'end';

  return { value: { content, stopReason, usage: hubUsageFrom(response.usage) }, fates };
}

function chatUsageFrom(usage: HubUsage): ChatUsage {
  return { prompt_tokens: usage.inputTokens ?? 0, completion_tokens: usage.outputTokens ?? 0 };
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
    usage: chatUsageFrom(hub.usage),
  };

  return { value: response, fates };
}

import type { TranslationRefusal } from '../refusals';
import type {
  ChatCompletionsResponse,
  ChatResponseImage,
  ChatResponseMessage,
} from './chat-completions-wire';
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

  if (response.choices.length > 1) {
    fates.push({ field: 'choices[extra]', disposition: 'mapped', to: 'absent', costBearing: true });
  }

  const content = choice ? hubContentFromMessage(choice.message) : [];
  const stopReason = choice ? hubStopFrom(choice.finish_reason) : 'end';

  return {
    value: {
      ...hubIdentity(response),
      content,
      stopReason,
      usage: hubUsageFromChat(response.usage),
    },
    fates,
  };
}

function hubIdentity(response: ChatCompletionsResponse): Pick<HubResponse, 'id' | 'model'> {
  return {
    ...(response.id === undefined ? {} : { id: response.id }),
    ...(response.model === undefined ? {} : { model: response.model }),
  };
}

export function encodeResponse(
  hub: HubResponse,
): TranslateResult<ChatCompletionsResponse, TranslationRefusal> {
  const finish = chatFinishFrom(hub.stopReason);

  if ('refusal' in finish) {
    return { refusal: finish.refusal };
  }

  const fates: Fate[] = [];

  if (finish.lossy) {
    fates.push({ field: 'stopReason', disposition: 'mapped', to: 'finish_reason (lossy)' });
  }

  const nonImageContent = hub.content.filter((block) => block.type !== 'image');
  const { text, toolCalls } = foldAssistantBlocks(nonImageContent, fates);
  const images = chatImagesFrom(hub.content);
  const message: ChatResponseMessage = {
    role: 'assistant',
    content: text,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    ...(images.length > 0 ? { images } : {}),
  };
  const response: ChatCompletionsResponse = {
    ...chatIdentity(hub),
    choices: [{ index: 0, message, finish_reason: finish.finish }],
    usage: chatUsageFromHub(hub.usage),
  };

  return { value: response, fates };
}

function chatImagesFrom(content: readonly HubContentBlock[]): ChatResponseImage[] {
  return content.flatMap((block) => {
    if (block.type !== 'image') return [];

    const source = block.source;
    const url =
      source.type === 'url' ? source.url : `data:${source.mediaType};base64,${source.data}`;

    return [{ type: 'image_url', image_url: { url } }];
  });
}

function chatIdentity(hub: HubResponse): Pick<ChatCompletionsResponse, 'id' | 'model'> {
  return {
    ...(hub.id === undefined ? {} : { id: hub.id }),
    ...(hub.model === undefined ? {} : { model: hub.model }),
  };
}

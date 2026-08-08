import type { HubMessage, HubRequest } from './hub';
import type { ResponsesRequest } from './responses-wire';

import { sanitizeToolId } from './tool-id';

export function mergeResponsesMessagesForChat(source: readonly HubMessage[]): HubMessage[] {
  const messages: HubMessage[] = [];

  for (const message of source) {
    const last = messages.at(-1);

    if (canMergeAssistant(last, message)) {
      messages[messages.length - 1] = {
        role: 'assistant',
        content: [...last.content, ...message.content],
      };
    } else if (message.content.length > 0) {
      messages.push(message);
    }
  }

  return messages;
}

function canMergeAssistant(
  previous: HubMessage | undefined,
  next: HubMessage,
): previous is HubMessage {
  return previous?.role === 'assistant' && next.role === 'assistant';
}

export function restoreResponsesChatToolIds(
  value: HubRequest,
  request: ResponsesRequest,
): HubRequest {
  const ids = chatToolIds(request);

  return {
    ...value,
    messages: value.messages.map((message) => ({
      ...message,
      content: message.content.map((block) => {
        if (block.type === 'tool_use') return { ...block, id: ids.get(block.id) ?? block.id };

        if (block.type === 'tool_result') {
          return { ...block, toolUseId: ids.get(block.toolUseId) ?? block.toolUseId };
        }

        return block;
      }),
    })),
  };
}

function chatToolIds(request: ResponsesRequest): ReadonlyMap<string, string> {
  const ids = new Map<string, string>();

  for (const item of request.input) {
    if (item.type === 'function_call' || item.type === 'function_call_output') {
      ids.set(sanitizeToolId(item.call_id), item.call_id);
    }
  }

  return ids;
}

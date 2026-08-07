import type { ChatContentPart, ChatToolMessage } from './chat-completions-wire';
import type { HubToolResultBlock, HubToolResultContent } from './hub';

import { imageSourceFromUrl } from './hub-build';
import { sanitizeToolId } from './tool-id';

function toolResultContentFrom(part: ChatContentPart): HubToolResultContent {
  if (part.type === 'text') {
    return { type: 'text', text: part.text };
  }

  if (part.type === 'image_url') {
    return { type: 'image', source: imageSourceFromUrl(part.image_url.url) };
  }

  return { type: 'text', text: JSON.stringify(part) };
}

function toolResultContent(
  content: string | readonly ChatContentPart[],
): readonly HubToolResultContent[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map(toolResultContentFrom);
}

export function toolResultBlockFrom(message: ChatToolMessage): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: sanitizeToolId(message.tool_call_id),
    content: toolResultContent(message.content),
  };
}

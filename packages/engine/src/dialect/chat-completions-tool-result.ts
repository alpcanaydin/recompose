import type { ChatContentPart, ChatToolMessage } from './chat-completions-wire';
import type { HubImageSource, HubToolResultBlock, HubToolResultContent } from './hub';

import { sanitizeToolId } from './tool-id';

const dataUri = /^data:([^;]+);base64,(.*)$/;

function imageSourceFrom(url: string): HubImageSource {
  const match = dataUri.exec(url);

  if (match === null) {
    return { type: 'url', url };
  }

  return { type: 'base64', mediaType: match[1] ?? '', data: match[2] ?? '' };
}

function toolResultContentFrom(part: ChatContentPart): HubToolResultContent {
  if (part.type === 'text') {
    return { type: 'text', text: part.text };
  }

  return { type: 'image', source: imageSourceFrom(part.image_url.url) };
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

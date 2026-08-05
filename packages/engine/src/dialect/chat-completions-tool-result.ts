import type { ChatToolMessage } from './chat-completions-wire';
import type { HubToolResultBlock } from './hub';

import { sanitizeToolId } from './tool-id';

export function toolResultBlockFrom(message: ChatToolMessage): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: sanitizeToolId(message.tool_call_id),
    content: [{ type: 'text', text: message.content }],
  };
}

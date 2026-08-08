import type { HubContentBlock, HubMessage, HubRequest } from './hub';

import { restoreGeminiClaudeCarriersV2 } from './gemini-claude-carrier-restore';

function category(block: HubContentBlock): 0 | 1 | 2 {
  if (block.type === 'thinking') return thinkingCategory(block);
  if (block.type === 'redacted_thinking') return 0;
  if (block.type === 'tool_use') return 2;

  return 1;
}

function thinkingCategory(block: Extract<HubContentBlock, { type: 'thinking' }>): 0 | 1 | 2 {
  if (isTrailingCarrier(block)) return 2;

  return isEmptyCarrier(block) ? 1 : 0;
}

function isTrailingCarrier(block: Extract<HubContentBlock, { type: 'thinking' }>): boolean {
  return block.text === '' && block.carrierDirection === 'previous';
}

function isEmptyCarrier(block: Extract<HubContentBlock, { type: 'thinking' }>): boolean {
  return block.text === '' && block.signature !== undefined;
}

function orderedContent(content: readonly HubContentBlock[]): HubContentBlock[] {
  const thinking: HubContentBlock[] = [];
  const regular: HubContentBlock[] = [];
  const tools: HubContentBlock[] = [];

  for (const block of content) {
    const target = category(block) === 0 ? thinking : category(block) === 2 ? tools : regular;

    target.push(block);
  }

  return [...thinking, ...regular, ...tools];
}

function orderedMessage(message: HubMessage): HubMessage {
  const restored = restoreGeminiClaudeCarriersV2(message);

  return restored.role === 'assistant'
    ? { ...restored, content: orderedContent(restored.content) }
    : restored;
}

export function orderClaudeContentForGemini(request: HubRequest): HubRequest {
  return { ...request, messages: request.messages.map(orderedMessage) };
}

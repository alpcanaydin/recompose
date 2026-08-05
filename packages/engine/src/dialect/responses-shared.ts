import type {
  HubContentBlock,
  HubImageBlock,
  HubImageSource,
  HubJsonObject,
  HubTextBlock,
  HubThinkingBlock,
  HubToolResultBlock,
  HubToolUseBlock,
} from './hub';
import type {
  ResponsesContentPart,
  ResponsesFunctionCallItem,
  ResponsesFunctionCallOutputItem,
  ResponsesReasoningItem,
} from './responses-wire';

function isJsonObject(value: unknown): value is HubJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseArguments(raw: string): HubJsonObject {
  const parsed: unknown = JSON.parse(raw);

  return isJsonObject(parsed) ? parsed : {};
}

function imageSourceOf(imageUrl: string): HubImageSource {
  return { type: 'url', url: imageUrl };
}

function toHubContentBlock(part: ResponsesContentPart): HubTextBlock | HubImageBlock {
  switch (part.type) {
    case 'input_text':
    case 'output_text':
      return { type: 'text', text: part.text };
    case 'input_image':
      return { type: 'image', source: imageSourceOf(part.image_url) };

    default: {
      const unhandled: never = part;

      throw new Error(`unhandled responses content part: ${String(unhandled)}`);
    }
  }
}

export function toHubContentBlocks(
  content: string | readonly ResponsesContentPart[],
): HubContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map(toHubContentBlock);
}

export function toolUseBlockOf(item: ResponsesFunctionCallItem): HubToolUseBlock {
  return {
    type: 'tool_use',
    id: item.call_id,
    name: item.name,
    input: parseArguments(item.arguments),
  };
}

export function toolResultBlockOf(item: ResponsesFunctionCallOutputItem): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: item.call_id,
    content: [{ type: 'text', text: item.output }],
  };
}

export function thinkingBlockOf(item: ResponsesReasoningItem): HubThinkingBlock {
  return {
    type: 'thinking',
    text: (item.summary ?? []).map((part) => part.text).join('\n'),
  };
}

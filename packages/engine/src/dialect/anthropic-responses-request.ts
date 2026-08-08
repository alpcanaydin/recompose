import type { TranslationRefusal } from '../refusals';
import type { TranslateResult } from './fates';
import type { HubContentBlock, HubMessage, HubRequest, HubToolResultBlock } from './hub';

function imageUrl(block: Extract<HubContentBlock, { type: 'image' }>): string {
  const source = block.source;

  return source.type === 'url' ? source.url : `data:${source.mediaType};base64,${source.data}`;
}

function structuredToolResult(block: HubToolResultBlock): HubToolResultBlock {
  if (!block.content.some((part) => part.type === 'image')) return block;

  const structuredResult = block.content.map((part) =>
    part.type === 'text'
      ? { type: 'input_text', text: part.text }
      : { type: 'input_image', image_url: imageUrl(part) },
  );

  return { ...block, structuredResult };
}

function requestBlock(block: HubContentBlock): HubContentBlock {
  return block.type === 'tool_result' ? structuredToolResult(block) : block;
}

function requestMessage(message: HubMessage): HubMessage {
  return { ...message, content: message.content.map(requestBlock) };
}

export function anthropicRequestForResponses(
  decoded: TranslateResult<HubRequest, TranslationRefusal>,
  sourceModel: string | undefined,
): TranslateResult<HubRequest, TranslationRefusal> {
  if ('refusal' in decoded) return decoded;

  return {
    ...decoded,
    value: {
      ...decoded.value,
      sourceModel: sourceModel ?? 'anthropic',
      parallelToolCalls: decoded.value.parallelToolCalls ?? true,
      messages: decoded.value.messages.map(requestMessage),
    },
  };
}

import type { HubContentBlock, HubImageSource, HubToolUseBlock } from './hub';
import type { InteractionsContentPart, InteractionsStep } from './interactions-wire';

import { imageSourceFromUrl } from './hub-build';

export function interactionsText(
  value: string | readonly InteractionsContentPart[] | undefined,
): string {
  if (typeof value === 'string') return value;

  return (value ?? []).flatMap((part) => ('text' in part ? [part.text] : [])).join('');
}

function mediaUrl(part: Exclude<InteractionsContentPart, { text: string }>): string | undefined {
  if (part.uri !== undefined) return part.uri;
  if (part.data === undefined) return undefined;

  return `data:${part.mime_type ?? 'image/png'};base64,${part.data}`;
}

function contentPartBlock(part: InteractionsContentPart): HubContentBlock[] {
  if ('text' in part) return [{ type: 'text', text: part.text }];
  if (part.type !== 'image') return [];

  const url = mediaUrl(part);

  return url === undefined ? [] : [{ type: 'image', source: imageSourceFromUrl(url) }];
}

export function hubBlocksFromInteractionsContent(
  value: string | readonly InteractionsContentPart[],
): HubContentBlock[] {
  return typeof value === 'string'
    ? [{ type: 'text', text: value }]
    : value.flatMap(contentPartBlock);
}

export function interactionsImagePart(source: HubImageSource): InteractionsContentPart {
  return source.type === 'url'
    ? { type: 'image', uri: source.url }
    : { type: 'image', data: source.data, mime_type: source.mediaType };
}

export function interactionsToolCall(block: HubToolUseBlock): InteractionsStep {
  return {
    type: 'function_call',
    id: block.id,
    call_id: block.id,
    name: block.name,
    arguments: block.input,
    ...(block.signature === undefined ? {} : { signature: block.signature }),
  };
}

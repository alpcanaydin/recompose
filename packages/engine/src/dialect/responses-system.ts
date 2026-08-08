import type { HubCacheBreakpoint, HubSystemText } from './hub';
import type {
  ResponsesCacheControl,
  ResponsesContentPart,
  ResponsesMessageItem,
  ResponsesRequest,
} from './responses-wire';

function breakpoint(control: ResponsesCacheControl | undefined): HubCacheBreakpoint | undefined {
  return control === undefined
    ? undefined
    : { type: 'ephemeral', ...(control.ttl === undefined ? {} : { ttl: control.ttl }) };
}

function partBlock(part: ResponsesContentPart): HubSystemText {
  const cacheBreakpoint = breakpoint(part.cache_control);

  return part.type === 'input_text' || part.type === 'output_text'
    ? { text: part.text, ...(cacheBreakpoint === undefined ? {} : { cacheBreakpoint }) }
    : {
        text: '',
        markerType: part.type,
        ...(cacheBreakpoint === undefined ? {} : { cacheBreakpoint }),
      };
}

function messageBlocks(message: ResponsesMessageItem): HubSystemText[] {
  const blocks =
    typeof message.content === 'string'
      ? [{ text: message.content }]
      : message.content.map(partBlock);
  const messageBreakpoint = breakpoint(message.cache_control);
  const last = blocks.at(-1);

  if (last !== undefined && last.cacheBreakpoint === undefined && messageBreakpoint !== undefined) {
    blocks[blocks.length - 1] = { ...last, cacheBreakpoint: messageBreakpoint };
  }

  return blocks;
}

export function isResponsesSystemMessage(
  item: ResponsesRequest['input'][number],
): item is ResponsesMessageItem & { role: 'system' | 'developer' } {
  return item.type === 'message' && (item.role === 'system' || item.role === 'developer');
}

export function responsesSystem(request: ResponsesRequest): HubSystemText[] | undefined {
  const blocks: HubSystemText[] =
    request.instructions === undefined ? [] : [{ text: request.instructions }];

  for (const item of request.input) {
    if (isResponsesSystemMessage(item)) blocks.push(...messageBlocks(item));
  }

  return blocks.length === 0 ? undefined : blocks;
}

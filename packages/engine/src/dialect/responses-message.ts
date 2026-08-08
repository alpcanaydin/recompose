import type { HubCacheBreakpoint, HubContentBlock } from './hub';
import type { ResponsesMessageItem } from './responses-wire';

import { toHubContentBlocks } from './responses-shared';

function cacheBreakpointOf(item: ResponsesMessageItem): HubCacheBreakpoint | undefined {
  const control = item.cache_control;

  return control === undefined
    ? undefined
    : { type: 'ephemeral', ...(control.ttl === undefined ? {} : { ttl: control.ttl }) };
}

export function responsesMessageContent(item: ResponsesMessageItem): HubContentBlock[] {
  const blocks = toHubContentBlocks(item.content);
  const breakpoint = cacheBreakpointOf(item);
  const last = blocks.at(-1);

  if (last?.type === 'text' && last.cacheBreakpoint === undefined && breakpoint !== undefined) {
    blocks[blocks.length - 1] = { ...last, cacheBreakpoint: breakpoint };
  }

  return blocks;
}

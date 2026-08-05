import type { ChatContentPart, ChatUserMessage } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubCacheBreakpoint, HubContentBlock } from './hub';

import { hubBreakpointFrom } from './chat-completions-cache';

function textBlock(
  text: string,
  breakpoint: HubCacheBreakpoint | undefined,
  fates: Fate[],
): readonly HubContentBlock[] {
  if (text === '') {
    fates.push({ field: 'content', disposition: 'mapped', to: 'absent' });

    return [];
  }

  return [
    { type: 'text', text, ...(breakpoint === undefined ? {} : { cacheBreakpoint: breakpoint }) },
  ];
}

function partBlock(
  part: ChatContentPart,
  messageBreakpoint: HubCacheBreakpoint | undefined,
  fates: Fate[],
): readonly HubContentBlock[] {
  if (part.type === 'text') {
    return textBlock(part.text, hubBreakpointFrom(part.cache_control) ?? messageBreakpoint, fates);
  }

  return [{ type: 'image', source: { type: 'url', url: part.image_url.url } }];
}

export function userBlocks(message: ChatUserMessage, fates: Fate[]): readonly HubContentBlock[] {
  const messageBreakpoint = hubBreakpointFrom(message.cache_control);

  if (typeof message.content === 'string') {
    return textBlock(message.content, messageBreakpoint, fates);
  }

  return message.content.flatMap((part) => partBlock(part, messageBreakpoint, fates));
}

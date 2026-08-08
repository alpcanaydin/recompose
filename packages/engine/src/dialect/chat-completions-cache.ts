import type { ChatCacheControl } from './chat-completions-wire';
import type { HubCacheBreakpoint } from './hub';

export function hubBreakpointFrom(
  control: ChatCacheControl | undefined,
): HubCacheBreakpoint | undefined {
  return control === undefined
    ? undefined
    : { type: 'ephemeral', ...(control.ttl === undefined ? {} : { ttl: control.ttl }) };
}

export function chatCacheControlFrom(breakpoint: HubCacheBreakpoint | undefined): {
  cache_control?: ChatCacheControl;
} {
  return breakpoint === undefined
    ? {}
    : {
        cache_control: {
          type: 'ephemeral',
          ...(breakpoint.ttl === undefined ? {} : { ttl: breakpoint.ttl }),
        },
      };
}

import type { HubStreamEvent } from './hub';
import type { ResponsesBlockState } from './responses-stream-state';
import type { ResponsesStreamItem } from './responses-wire';

import { responsesIdentifier, sanitizeToolId } from './tool-id';

function webSearchId(item: ResponsesStreamItem, index: number): string {
  return responsesIdentifier(
    sanitizeToolId(item.call_id ?? item.id ?? `toolu_stream_${String(index)}`),
  );
}

export function webSearchOpening(
  index: number,
  item: ResponsesStreamItem,
): HubStreamEvent | undefined {
  if (item.type !== 'web_search_call') return undefined;

  return {
    type: 'block-open',
    index,
    opening: {
      kind: 'tool',
      id: webSearchId(item, index),
      name: 'web_search',
      signature: 'server:web-search',
    },
  };
}

export function webSearchDoneEvents(
  state: ResponsesBlockState,
  index: number,
  item: ResponsesStreamItem,
): HubStreamEvent[] | null {
  if (item.type !== 'web_search_call') return null;

  const id = webSearchId(item, index);
  const query = item.action?.query;
  const argumentsDelta: HubStreamEvent[] =
    query === undefined
      ? []
      : [
          {
            type: 'block-delta',
            index,
            delta: { kind: 'json-args', partialJson: JSON.stringify({ query }) },
          },
        ];

  state.open.delete(index);
  state.closed.add(index);

  return [
    ...argumentsDelta,
    { type: 'block-close', index },
    {
      type: 'block-open',
      index: index + 1,
      opening: { kind: 'tool', id, name: 'web_search', signature: 'server:web-search-result' },
    },
    { type: 'block-close', index: index + 1 },
  ];
}

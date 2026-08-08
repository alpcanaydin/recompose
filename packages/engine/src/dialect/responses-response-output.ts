import type { Fate } from './fates';
import type { HubContentBlock } from './hub';
import type { ResponsesOutputItem } from './responses-wire';

import { reasoningOutcome } from './responses-reasoning-decode';
import { toolUseBlockOf } from './responses-shared';
import { responsesIdentifier } from './tool-id';

export type OutputOutcome = { blocks: HubContentBlock[]; fates: Fate[] };

export function outputOutcomeOf(item: ResponsesOutputItem): OutputOutcome {
  if (item.type === 'custom_tool_call') return customToolOutcome(item);
  if (item.type === 'image_generation_call') return imageOutputOutcome(item);
  if (item.type === 'web_search_call') return webSearchOutcome(item);

  return coreOutputOutcome(item);
}

function customToolOutcome(
  item: Extract<ResponsesOutputItem, { type: 'custom_tool_call' }>,
): OutputOutcome {
  return {
    blocks: [
      {
        type: 'tool_use',
        id: responsesIdentifier(item.call_id),
        name: item.name,
        input: item.input,
        family: 'custom',
      },
    ],
    fates: [],
  };
}

function coreOutputOutcome(
  item: Extract<ResponsesOutputItem, { type: 'message' | 'function_call' | 'reasoning' }>,
): OutputOutcome {
  switch (item.type) {
    case 'message':
      return { blocks: item.content.map((part) => ({ type: 'text', text: part.text })), fates: [] };
    case 'function_call':
      return { blocks: [toolUseBlockOf(item)], fates: [] };
    case 'reasoning':
      return reasoningOutcome(item);

    default: {
      const unhandled: never = item;

      throw new Error(`unhandled responses output item: ${JSON.stringify(unhandled)}`);
    }
  }
}

function webSearchOutcome(
  item: Extract<ResponsesOutputItem, { type: 'web_search_call' }>,
): OutputOutcome {
  if (item.action?.type !== 'search' || item.action.query === undefined)
    return { blocks: [], fates: [] };

  const id = responsesIdentifier(item.id ?? 'web_search');

  return {
    blocks: [
      {
        type: 'tool_use',
        id,
        name: 'web_search',
        input: { query: item.action.query },
        signature: 'server:web-search',
      },
      {
        type: 'tool_use',
        id,
        name: 'web_search',
        input: {},
        signature: 'server:web-search-result',
      },
    ],
    fates: [],
  };
}

function imageOutputOutcome(
  item: Extract<ResponsesOutputItem, { type: 'image_generation_call' }>,
): OutputOutcome {
  return {
    blocks: [
      {
        type: 'image',
        source: {
          type: 'base64',
          mediaType: `image/${item.output_format ?? 'png'}`,
          data: item.result,
        },
      },
    ],
    fates: [],
  };
}

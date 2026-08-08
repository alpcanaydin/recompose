import type {
  AnthropicContentBlock,
  AnthropicResponse,
  AnthropicStreamContentBlock,
} from './anthropic-wire';
import type { Fate, Translated } from './fates';
import type { HubResponse } from './hub';

import { hubBlockFrom, wireBlockFrom } from './anthropic-blocks';
import { hubStopFrom, wireStopFrom } from './anthropic-stops';
import { hubUsageFrom, wireUsageFrom } from './anthropic-usage';
import { anthropicWebSearchResults } from './anthropic-web-search-results';

export const translatedMessageId = 'msg_translated';

export function decodeResponse(response: AnthropicResponse): Translated<HubResponse> {
  const fates: Fate[] = [];

  if (response.stop_sequence !== undefined && response.stop_sequence !== null) {
    fates.push({ field: 'stop_sequence', disposition: 'mapped', to: 'absent' });
  }

  return {
    value: {
      id: response.id,
      ...(response.model === undefined ? {} : { model: response.model }),
      content: response.content.flatMap((block) => hubResponseBlocks(block, fates)),
      stopReason: hubStopFrom(response.stop_reason),
      usage: hubUsageFrom(response.usage),
    },
    fates,
  };
}

function hubResponseBlocks(
  block: AnthropicStreamContentBlock,
  fates: Fate[],
): HubResponse['content'][number][] {
  if (!isAnthropicContentBlock(block)) return [];

  return [hubBlockFrom(block, fates)];
}

function isAnthropicContentBlock(
  block: AnthropicStreamContentBlock,
): block is AnthropicContentBlock {
  return block.type !== 'server_tool_use' && block.type !== 'web_search_tool_result';
}

export function encodeResponse(hub: HubResponse): Translated<AnthropicResponse> {
  return {
    value: {
      id: hub.id ?? translatedMessageId,
      type: 'message',
      role: 'assistant',
      ...(hub.model === undefined ? {} : { model: hub.model }),
      content: hub.content.map(wireResponseBlock),
      stop_reason: wireStopFrom(hub.stopReason),
      stop_sequence: hub.stopSequence ?? null,
      usage: wireUsageFrom(hub.usage),
    },
    fates: [],
  };
}

function wireResponseBlock(block: HubResponse['content'][number]): AnthropicStreamContentBlock {
  if (block.type === 'tool_use' && block.signature === 'server:web-search') {
    return { type: 'server_tool_use', id: block.id, name: 'web_search', input: block.input };
  }

  if (block.type === 'tool_use' && block.signature === 'server:web-search-result') {
    return {
      type: 'web_search_tool_result',
      tool_use_id: block.id,
      content: anthropicWebSearchResults(block.input),
    };
  }

  return wireBlockFrom(block);
}

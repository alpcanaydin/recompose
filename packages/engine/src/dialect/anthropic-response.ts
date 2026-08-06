import type { AnthropicResponse } from './anthropic-wire';
import type { Fate, Translated } from './fates';
import type { HubResponse } from './hub';

import { hubBlockFrom, wireBlockFrom } from './anthropic-blocks';
import { hubStopFrom, wireStopFrom } from './anthropic-stops';
import { hubUsageFrom, wireUsageFrom } from './anthropic-usage';

export const translatedMessageId = 'msg_translated';

export function decodeResponse(response: AnthropicResponse): Translated<HubResponse> {
  const fates: Fate[] = [];

  if (response.stop_sequence !== undefined && response.stop_sequence !== null) {
    fates.push({ field: 'stop_sequence', disposition: 'mapped', to: 'absent' });
  }

  return {
    value: {
      content: response.content.map(hubBlockFrom),
      stopReason: hubStopFrom(response.stop_reason),
      usage: hubUsageFrom(response.usage),
    },
    fates,
  };
}

export function encodeResponse(hub: HubResponse): Translated<AnthropicResponse> {
  return {
    value: {
      id: translatedMessageId,
      type: 'message',
      role: 'assistant',
      content: hub.content.map(wireBlockFrom),
      stop_reason: wireStopFrom(hub.stopReason),
      stop_sequence: null,
      usage: wireUsageFrom(hub.usage),
    },
    fates: [],
  };
}

import type { TranslationRefusal } from '../refusals';
import type { ChatFinishReason } from './chat-completions-wire';
import type { HubStopReason } from './hub';

import { unmappableStopReason } from '../refusals';

export function hubStopFrom(reason: ChatFinishReason): HubStopReason {
  switch (reason) {
    case 'stop':
      return 'end';
    case 'length':
      return 'max_output';
    case 'tool_calls':
      return 'tool_use';
    case 'content_filter':
      return 'refusal';

    default: {
      const unknownReason: never = reason;

      throw new Error(`no hub stop reason for the finish reason: ${JSON.stringify(unknownReason)}`);
    }
  }
}

export type FinishResult =
  | { finish: ChatFinishReason; lossy: boolean }
  | { refusal: TranslationRefusal };

function mappableFinish(reason: 'end' | 'max_output' | 'tool_use' | 'stop_sequence'): FinishResult {
  switch (reason) {
    case 'end':
      return { finish: 'stop', lossy: false };
    case 'max_output':
      return { finish: 'length', lossy: false };
    case 'tool_use':
      return { finish: 'tool_calls', lossy: false };
    case 'stop_sequence':
      return { finish: 'stop', lossy: false };

    default: {
      const unknownReason: never = reason;

      throw new Error(`no finish reason for the hub stop reason: ${JSON.stringify(unknownReason)}`);
    }
  }
}

export function chatFinishFrom(reason: HubStopReason): FinishResult {
  if (reason === 'refusal') {
    return { finish: 'content_filter', lossy: true };
  }

  if (reason === 'paused' || reason === 'context_overflow') {
    return { refusal: unmappableStopReason(reason) };
  }

  return mappableFinish(reason);
}

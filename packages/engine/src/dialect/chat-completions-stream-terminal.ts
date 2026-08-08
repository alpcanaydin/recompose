import type { TranslationRefusal } from '../refusals';
import type { ChatStreamError, ChatStreamFrame } from './chat-completions-wire';
import type { HubUsage } from './hub';

import { chatUsageFromHub } from './chat-completions-usage';

export function usageChunk(usage: HubUsage): ChatStreamFrame {
  return { type: 'chunk', chunk: { choices: [], usage: chatUsageFromHub(usage) } };
}

export function streamErrorFromRefusal(refusal: TranslationRefusal): ChatStreamError {
  return {
    type: 'invalid_request_error',
    message: `the stop reason has no Chat Completions form: ${refusal.reason}`,
  };
}

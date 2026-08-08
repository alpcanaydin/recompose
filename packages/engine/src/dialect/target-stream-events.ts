import type { Dialect } from '../refusals';
import type { HubStreamEvent } from './hub';

import { mergeAnthropicResponseText } from './anthropic-responses-stream';

export function targetStreamEvents(
  from: Dialect,
  to: Dialect,
  decoded: AsyncIterable<HubStreamEvent>,
): AsyncIterable<HubStreamEvent> {
  return from === 'anthropic' && to === 'responses' ? mergeAnthropicResponseText(decoded) : decoded;
}

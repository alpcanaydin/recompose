import type { HubStreamEvent } from './hub';
import type { ResponsesStreamResponse } from './responses-wire';

export function responsesTerminalDetails(
  response: ResponsesStreamResponse,
  stopReason: Extract<HubStreamEvent, { type: 'message-end' }>['stopReason'],
): Pick<
  Extract<HubStreamEvent, { type: 'message-end' }>,
  'stopReason' | 'stopSequence' | 'nativeStopReason'
> {
  if (response.stop_sequence !== undefined)
    return { stopReason: 'stop_sequence', stopSequence: response.stop_sequence };
  const reason = response.status === 'incomplete' ? response.incomplete_details?.reason : undefined;

  return reason === undefined ? { stopReason } : { stopReason, nativeStopReason: reason };
}

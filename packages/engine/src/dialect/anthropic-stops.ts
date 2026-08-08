import type { AnthropicKnownStopReason, AnthropicStopReason } from './anthropic-wire';
import type { HubStopReason } from './hub';

const hubStopByWire: Record<string, HubStopReason> = {
  end_turn: 'end',
  max_tokens: 'max_output',
  stop_sequence: 'stop_sequence',
  tool_use: 'tool_use',
  pause_turn: 'paused',
  refusal: 'refusal',
  model_context_window_exceeded: 'context_overflow',
};

export function hubStopFrom(reason: AnthropicStopReason | null | undefined): HubStopReason {
  if (reason === null || reason === undefined) {
    return 'end';
  }

  return hubStopByWire[reason] ?? 'end';
}

const wireStopByHub: Record<HubStopReason, AnthropicKnownStopReason> = {
  end: 'end_turn',
  max_output: 'max_tokens',
  stop_sequence: 'stop_sequence',
  tool_use: 'tool_use',
  paused: 'pause_turn',
  refusal: 'refusal',
  context_overflow: 'model_context_window_exceeded',
};

export function wireStopFrom(reason: HubStopReason): AnthropicKnownStopReason {
  return wireStopByHub[reason];
}

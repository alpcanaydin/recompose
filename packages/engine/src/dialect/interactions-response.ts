import type { Translated } from './fates';
import type { HubContentBlock, HubResponse, HubStopReason, HubUsage } from './hub';
import type {
  InteractionsResponse,
  InteractionsStep,
  InteractionsUsage,
} from './interactions-wire';

import { parseToolArguments } from './hub-build';
import {
  hubBlocksFromInteractionsContent,
  interactionsPartFromHubMedia,
  interactionsText,
  interactionsToolCall,
  isHubInteractionsMedia,
} from './interactions-content';

function thoughtBlock(step: Extract<InteractionsStep, { type: 'thought' }>): HubContentBlock {
  return {
    type: 'thinking',
    text: interactionsText(step.content),
    ...(step.signature === undefined ? {} : { signature: step.signature }),
  };
}

function functionBlock(
  step: Extract<InteractionsStep, { type: 'function_call' }>,
): HubContentBlock {
  return {
    type: 'tool_use',
    id: step.call_id ?? step.id ?? step.name,
    name: step.name,
    input: typeof step.arguments === 'string' ? parseToolArguments(step.arguments) : step.arguments,
    ...(step.signature === undefined ? {} : { signature: step.signature }),
  };
}

function stepBlock(step: InteractionsStep): HubContentBlock | HubContentBlock[] | null {
  if (step.type === 'model_output') return hubBlocksFromInteractionsContent(step.content);
  if (step.type === 'thought') return thoughtBlock(step);
  if (step.type === 'function_call') return functionBlock(step);

  return null;
}

export function hubUsageFromInteractions(usage: InteractionsUsage | undefined): HubUsage {
  if (usage === undefined) return {};

  const result: HubUsage = {};

  applyUsage(result, 'inputTokens', inputUsage(usage));
  applyUsage(result, 'outputTokens', outputUsage(usage));
  applyUsage(result, 'cacheReadTokens', cacheUsage(usage));
  applyUsage(result, 'reasoningTokens', reasoningUsage(usage));

  return result;
}

function inputUsage(usage: InteractionsUsage): number | undefined {
  return usage.total_input_tokens ?? usage.input_tokens ?? usage.prompt_tokens;
}

function outputUsage(usage: InteractionsUsage): number | undefined {
  return usage.total_output_tokens ?? usage.output_tokens ?? usage.completion_tokens;
}

function cacheUsage(usage: InteractionsUsage): number | undefined {
  return usage.total_cached_tokens ?? usage.cached_tokens;
}

function reasoningUsage(usage: InteractionsUsage): number | undefined {
  return usage.total_thought_tokens ?? usage.reasoning_tokens;
}

function applyUsage(result: HubUsage, field: keyof HubUsage, value: number | undefined): void {
  if (value !== undefined) result[field] = value;
}

export function interactionsUsage(usage: HubUsage): InteractionsUsage {
  const result: InteractionsUsage = {};

  applyInteractionUsage(result, 'total_input_tokens', usage.inputTokens);
  applyInteractionUsage(result, 'total_output_tokens', usage.outputTokens);
  applyInteractionUsage(result, 'cached_tokens', usage.cacheReadTokens);
  applyInteractionUsage(result, 'reasoning_tokens', usage.reasoningTokens);
  applyInteractionUsage(result, 'total_tokens', totalTokens(usage));

  return result;
}

function applyInteractionUsage(
  result: InteractionsUsage,
  field: keyof InteractionsUsage,
  value: number | undefined,
): void {
  if (value !== undefined) result[field] = value;
}

function totalTokens(usage: HubUsage): number | undefined {
  return usage.inputTokens === undefined && usage.outputTokens === undefined
    ? undefined
    : (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

function thoughtStep(block: Extract<HubContentBlock, { type: 'thinking' }>): InteractionsStep {
  return {
    type: 'thought',
    content: [{ type: 'text', text: block.text }],
    ...(block.signature === undefined ? {} : { signature: block.signature }),
  };
}

function toolStep(block: Extract<HubContentBlock, { type: 'tool_use' }>): InteractionsStep {
  return interactionsToolCall(block);
}

function mediaStep(
  block: Extract<HubContentBlock, { type: 'image' | 'audio' | 'video' | 'document' }>,
): InteractionsStep | null {
  const part = interactionsPartFromHubMedia(block);

  return part === null ? null : { type: 'model_output', content: [part] };
}

function outputStep(block: HubContentBlock): InteractionsStep | null {
  if (block.type === 'text') {
    return { type: 'model_output', content: [{ type: 'text', text: block.text }] };
  }

  if (block.type === 'thinking') return thoughtStep(block);
  if (block.type === 'tool_use') return toolStep(block);
  if (isHubInteractionsMedia(block)) return mediaStep(block);

  return null;
}

function responseStatus(reason: HubStopReason): string {
  if (reason === 'tool_use') return 'requires_action';
  if (reason === 'max_output' || reason === 'context_overflow') return 'incomplete';
  if (reason === 'refusal') return 'failed';

  return 'completed';
}

export function encodeResponse(response: HubResponse): Translated<InteractionsResponse> {
  const steps = response.content.flatMap((block) => {
    const step = outputStep(block);

    return step === null ? [] : [step];
  });

  return {
    value: {
      id: response.id ?? 'interaction_translated',
      ...(response.model === undefined ? {} : { model: response.model }),
      status: responseStatus(response.stopReason),
      steps,
      usage: interactionsUsage(response.usage),
    },
    fates: [],
  };
}

function stopReasonOf(response: InteractionsResponse): HubStopReason {
  if (response.steps.some((step) => step.type === 'function_call')) return 'tool_use';
  if (response.status === 'incomplete') return 'max_output';
  if (response.status === 'failed') return 'refusal';

  return 'end';
}

export function decodeResponse(response: InteractionsResponse): Translated<HubResponse> {
  const content = response.steps.flatMap((step) => {
    const block = stepBlock(step);

    return block === null ? [] : Array.isArray(block) ? block : [block];
  });

  return {
    value: {
      id: response.id,
      ...(response.model === undefined ? {} : { model: response.model }),
      content,
      stopReason: stopReasonOf(response),
      usage: hubUsageFromInteractions(response.usage),
    },
    fates: [],
  };
}

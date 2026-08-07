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
  interactionsText,
  interactionsToolCall,
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

function usageOf(usage: InteractionsUsage | undefined): HubUsage {
  if (usage === undefined) return {};

  const result: HubUsage = {};

  applyUsage(result, 'inputTokens', usage.total_input_tokens);
  applyUsage(result, 'outputTokens', usage.total_output_tokens);
  applyUsage(result, 'cacheReadTokens', usage.cached_tokens);
  applyUsage(result, 'reasoningTokens', usage.reasoning_tokens);

  return result;
}

function applyUsage(result: HubUsage, field: keyof HubUsage, value: number | undefined): void {
  if (value !== undefined) result[field] = value;
}

function interactionsUsage(usage: HubUsage): InteractionsUsage {
  return {
    ...(usage.inputTokens === undefined ? {} : { total_input_tokens: usage.inputTokens }),
    ...(usage.outputTokens === undefined ? {} : { total_output_tokens: usage.outputTokens }),
    ...(usage.cacheReadTokens === undefined ? {} : { cached_tokens: usage.cacheReadTokens }),
    ...(usage.reasoningTokens === undefined ? {} : { reasoning_tokens: usage.reasoningTokens }),
  };
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

function outputStep(block: HubContentBlock): InteractionsStep | null {
  if (block.type === 'text') {
    return { type: 'model_output', content: [{ type: 'text', text: block.text }] };
  }

  if (block.type === 'thinking') return thoughtStep(block);
  if (block.type === 'tool_use') return toolStep(block);

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
      id: 'interaction_translated',
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
    value: { content, stopReason: stopReasonOf(response), usage: usageOf(response.usage) },
    fates: [],
  };
}

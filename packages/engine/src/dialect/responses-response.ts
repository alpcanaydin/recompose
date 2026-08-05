import type { TranslationRefusal } from '../refusals';
import type { Fate, TranslateResult } from './fates';
import type { HubContentBlock, HubResponse } from './hub';
import type {
  ResponsesOutputItem,
  ResponsesOutputTextPart,
  ResponsesResponse,
} from './responses-wire';

import { unmappableStopReason } from '../refusals';
import { reasoningOutcome } from './responses-reasoning-decode';
import {
  functionCallItemOf,
  statusFromStopReason,
  stopReasonFromResponse,
  thinkingDropFate,
  toHubUsage,
  toolUseBlockOf,
  toResponsesUsage,
  translatedResponseId,
} from './responses-shared';

type OutputOutcome = { blocks: HubContentBlock[]; fates: Fate[] };

function outputOutcomeOf(item: ResponsesOutputItem): OutputOutcome {
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

export function decodeResponse(
  response: ResponsesResponse,
): TranslateResult<HubResponse, TranslationRefusal> {
  const hasFunctionCall = response.output.some((item) => item.type === 'function_call');
  const outcome = stopReasonFromResponse(
    response.status,
    hasFunctionCall,
    response.incomplete_details?.reason,
  );

  if ('unmappable' in outcome) {
    return { refusal: unmappableStopReason(outcome.unmappable) };
  }

  const outcomes = response.output.map(outputOutcomeOf);

  return {
    value: {
      content: outcomes.flatMap((entry) => entry.blocks),
      stopReason: outcome.stopReason,
      usage: toHubUsage(response.usage),
    },
    fates: outcomes.flatMap((entry) => entry.fates),
  };
}

type EncodedOutput = { output: ResponsesOutputItem[]; fates: Fate[] };

function droppedBlockFate(kind: string): Fate {
  return { field: kind, disposition: 'mapped', to: 'absent' };
}

function encodeOutput(content: readonly HubContentBlock[]): EncodedOutput {
  const output: ResponsesOutputItem[] = [];
  const fates: Fate[] = [];
  let texts: ResponsesOutputTextPart[] = [];

  const flush = (): void => {
    if (texts.length > 0) {
      output.push({ type: 'message', role: 'assistant', content: texts });
      texts = [];
    }
  };

  for (const block of content) {
    if (block.type === 'text') {
      texts.push({ type: 'output_text', text: block.text });
    } else if (block.type === 'tool_use') {
      flush();
      output.push(functionCallItemOf(block));
    } else if (block.type === 'thinking') {
      fates.push(thinkingDropFate());
    } else {
      fates.push(droppedBlockFate(block.type));
    }
  }

  flush();

  return { output, fates };
}

function lossyStopFate(): Fate {
  return { field: 'stopReason', disposition: 'mapped', to: 'incomplete.content_filter' };
}

export function encodeResponse(
  response: HubResponse,
): TranslateResult<ResponsesResponse, TranslationRefusal> {
  const outcome = statusFromStopReason(response.stopReason);

  if ('unmappable' in outcome) {
    return { refusal: unmappableStopReason(outcome.unmappable) };
  }

  const encoded = encodeOutput(response.content);
  const fates: Fate[] = [...encoded.fates, ...(outcome.lossy === true ? [lossyStopFate()] : [])];

  const value: ResponsesResponse = {
    id: translatedResponseId,
    status: outcome.status,
    output: encoded.output,
    ...(outcome.incompleteReason === undefined
      ? {}
      : { incomplete_details: { reason: outcome.incompleteReason } }),
    usage: toResponsesUsage(response.usage),
  };

  return { value, fates };
}

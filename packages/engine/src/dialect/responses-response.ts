import type { TranslationRefusal } from '../refusals';
import type { Fate, TranslateResult } from './fates';
import type { HubContentBlock, HubResponse } from './hub';
import type {
  ResponsesOutputItem,
  ResponsesOutputTextPart,
  ResponsesResponse,
} from './responses-wire';

import { unmappableStopReason } from '../refusals';
import {
  responsesItemForGeminiTextSignature,
  responsesItemsForGeminiToolUse,
} from './responses-gemini-carrier';
import { responsesReasoningEncryptedContent } from './responses-reasoning-signature';
import { outputOutcomeOf } from './responses-response-output';
import {
  statusFromStopReason,
  stopReasonFromResponse,
  toHubUsage,
  toResponsesUsage,
  translatedResponseId,
} from './responses-shared';

export function decodeResponse(
  response: ResponsesResponse,
): TranslateResult<HubResponse, TranslationRefusal> {
  const hasFunctionCall = response.output.some(
    (item) => item.type === 'function_call' || item.type === 'custom_tool_call',
  );
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
      id: response.id,
      ...(response.model === undefined ? {} : { model: response.model }),
      content: outcomes.flatMap((entry) => entry.blocks),
      ...responseStop(response, outcome.stopReason),
      usage: toHubUsage(response.usage),
    },
    fates: outcomes.flatMap((entry) => entry.fates),
  };
}

function responseStop(
  response: ResponsesResponse,
  fallback: HubResponse['stopReason'],
): Pick<HubResponse, 'stopReason' | 'stopSequence'> {
  return response.stop_sequence === undefined
    ? { stopReason: fallback }
    : { stopReason: 'stop_sequence', stopSequence: response.stop_sequence };
}

type EncodedOutput = { output: ResponsesOutputItem[]; fates: Fate[] };

function droppedBlockFate(kind: string): Fate {
  return { field: kind, disposition: 'mapped', to: 'absent' };
}

function reasoningItem(
  block: HubContentBlock,
  index: number,
): Extract<ResponsesOutputItem, { type: 'reasoning' }> | null {
  if (block.type === 'thinking') {
    return {
      type: 'reasoning',
      id: `rs_${String(index)}`,
      summary: block.text === '' ? [] : [{ type: 'summary_text', text: block.text }],
      content: null,
      ...responsesReasoningEncryptedContent(
        block.signature,
        block.carrierDirection,
        block.carrierTarget,
      ),
    };
  }

  return block.type === 'redacted_thinking'
    ? {
        type: 'reasoning',
        id: `rs_${String(index)}`,
        summary: [],
        content: null,
        encrypted_content: `claude-redacted-thinking:${block.data}`,
      }
    : null;
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
      appendTextBlock(output, texts, block, flush);

      continue;
    }

    if (block.type === 'tool_use') {
      flush();
      output.push(...responsesItemsForGeminiToolUse(block, true));
    } else {
      const reasoning = reasoningItem(block, output.length);

      if (reasoning === null) {
        fates.push(droppedBlockFate(block.type));

        continue;
      }

      flush();
      output.push(reasoning);
    }
  }

  flush();

  return { output, fates };
}

function appendTextBlock(
  output: ResponsesOutputItem[],
  texts: ResponsesOutputTextPart[],
  block: Extract<HubContentBlock, { type: 'text' }>,
  flush: () => void,
): void {
  const direction = block.signatureDirection ?? 'previous';
  const carrier = responsesItemForGeminiTextSignature(block.signature, direction);

  appendLeadingCarrier(output, carrier, direction, flush);

  texts.push({ type: 'output_text', text: block.text });
  appendTrailingCarrier(output, carrier, direction, flush);
}

function appendLeadingCarrier(
  output: ResponsesOutputItem[],
  carrier: ResponsesOutputItem | null,
  direction: 'previous' | 'next',
  flush: () => void,
): void {
  if (carrier === null || direction !== 'next') return;

  flush();
  output.push(carrier);
}

function appendTrailingCarrier(
  output: ResponsesOutputItem[],
  carrier: ResponsesOutputItem | null,
  direction: 'previous' | 'next',
  flush: () => void,
): void {
  if (carrier === null || direction === 'next') return;

  flush();
  output.push(carrier);
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
    ...responsesIdentity(response),
    status: outcome.status,
    output: encoded.output,
    ...(outcome.incompleteReason === undefined
      ? {}
      : { incomplete_details: { reason: outcome.incompleteReason } }),
    usage: toResponsesUsage(response.usage),
  };

  return { value, fates };
}

function responsesIdentity(response: HubResponse): Pick<ResponsesResponse, 'id' | 'model'> {
  return {
    id: response.id ?? translatedResponseId,
    ...(response.model === undefined ? {} : { model: response.model }),
  };
}

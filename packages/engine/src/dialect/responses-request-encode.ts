import type { Fate, Translated } from './fates';
import type {
  HubAudioBlock,
  HubDocumentBlock,
  HubImageBlock,
  HubMessage,
  HubRequest,
  HubSampling,
  HubTextBlock,
  HubThinkingBlock,
  HubToolResultBlock,
  HubToolUseBlock,
  HubVideoBlock,
} from './hub';
import type {
  ResponsesContentPart,
  ResponsesFunctionCallOutputItem,
  ResponsesInputItem,
  ResponsesRequest,
} from './responses-wire';

import { customResponsesCall, customResponsesOutput } from './responses-custom-tool-encode';
import { responsesItemsForGeminiToolUse } from './responses-gemini-carrier';
import { responsesPartFromHubBlock } from './responses-media-encode';
import { responsesOptionsInto } from './responses-request-options';
import {
  toResponsesTool,
  toResponsesToolChoice,
  toResponsesWebSearchTool,
} from './responses-request-tools-encode';
import {
  isCodexReasoningSignature,
  redactedThinkingDropFate,
  thinkingDropFate,
} from './responses-shared';
import { responsesIdentifier } from './tool-id';

function functionOutput(block: HubToolResultBlock): unknown {
  if (block.structuredResult === undefined) {
    return block.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
  }

  if (Array.isArray(block.structuredResult)) return block.structuredResult;

  return typeof block.structuredResult === 'string'
    ? block.structuredResult
    : JSON.stringify(block.structuredResult);
}

function functionCallOutputItemOf(
  block: HubToolResultBlock,
  fates: Fate[],
): ResponsesFunctionCallOutputItem {
  if (block.structuredResult === undefined && block.content.some((part) => part.type === 'image')) {
    fates.push({
      field: 'tool_result_image',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  }

  return {
    type: 'function_call_output',
    call_id: responsesIdentifier(block.toolUseId),
    ...(block.name === undefined ? {} : { name: block.name }),
    output: functionOutput(block),
  };
}

function itemsOfToolBlock(
  block: HubToolUseBlock | HubToolResultBlock,
  fates: Fate[],
): ResponsesInputItem[] {
  switch (block.type) {
    case 'tool_use':
      return block.family === 'custom'
        ? [customResponsesCall(block)]
        : responsesItemsForGeminiToolUse(block);
    case 'tool_result':
      return block.family === 'custom'
        ? [customResponsesOutput(block, functionOutput(block))]
        : [functionCallOutputItemOf(block, fates)];

    default: {
      const unhandled: never = block;

      throw new Error(`unhandled hub tool block: ${JSON.stringify(unhandled)}`);
    }
  }
}

type FoldedInput = { items: ResponsesInputItem[]; fates: Fate[] };

type EncodeContext = {
  readonly role: 'user' | 'assistant';
  readonly sourceModel?: string;
  parts: ResponsesContentPart[];
  readonly items: ResponsesInputItem[];
  readonly fates: Fate[];
};

function flushParts(context: EncodeContext): void {
  if (context.parts.length > 0) {
    context.items.push({ type: 'message', role: context.role, content: context.parts });
    context.parts = [];
  }
}

function encodeThinkingInto(block: HubThinkingBlock, context: EncodeContext): void {
  if (context.role !== 'assistant' || !carriedReasoning(block.signature, context.sourceModel)) {
    context.fates.push(thinkingDropFate());

    return;
  }

  flushParts(context);
  context.items.push({
    type: 'reasoning',
    summary: [],
    content: null,
    encrypted_content: block.signature,
  });
  context.fates.push({ field: 'thinking.signature', disposition: 'carried' });
}

function carriedReasoning(
  signature: string | undefined,
  sourceModel: string | undefined,
): signature is string {
  if (signature === '') return true;
  if (isCodexReasoningSignature(signature)) return true;

  return sourceModel?.startsWith('grok-') === true && isGrokSignature(signature);
}

function isGrokSignature(signature: string | undefined): signature is string {
  return (
    signature !== undefined && signature.length > 200 && /^[A-Za-z0-9+/]+={0,2}$/u.test(signature)
  );
}

function isVisibleBlock(
  block: HubMessage['content'][number],
): block is HubTextBlock | HubImageBlock | HubDocumentBlock | HubAudioBlock | HubVideoBlock {
  return ['text', 'image', 'document', 'audio', 'video'].includes(block.type);
}

function encodeBlockInto(block: HubMessage['content'][number], context: EncodeContext): void {
  if (isVisibleBlock(block)) {
    context.parts.push(responsesPartFromHubBlock(context.role, block));

    return;
  }

  if (block.type === 'thinking') {
    encodeThinkingInto(block, context);

    return;
  }

  if (block.type === 'redacted_thinking') {
    context.fates.push(redactedThinkingDropFate());

    return;
  }

  flushParts(context);
  context.items.push(...itemsOfToolBlock(block, context.fates));
}

function encodeMessage(message: HubMessage, sourceModel?: string): FoldedInput {
  const context: EncodeContext = {
    role: message.role,
    ...(sourceModel === undefined ? {} : { sourceModel }),
    parts: [],
    items: [],
    fates: [],
  };

  for (const block of message.content) {
    encodeBlockInto(block, context);
  }

  flushParts(context);

  return { items: context.items, fates: context.fates };
}

function encodeMessages(messages: readonly HubMessage[], sourceModel?: string): FoldedInput {
  const items: ResponsesInputItem[] = [];
  const fates: Fate[] = [];

  for (const message of messages) {
    const folded = encodeMessage(message, sourceModel);

    items.push(...folded.items);
    fates.push(...folded.fates);
  }

  return { items, fates };
}

function encodeSampling(
  sampling: HubSampling | undefined,
): Pick<ResponsesRequest, 'temperature' | 'top_p' | 'max_output_tokens'> {
  if (sampling === undefined) {
    return {};
  }

  return {
    ...(sampling.temperature === undefined ? {} : { temperature: sampling.temperature }),
    ...(sampling.topP === undefined ? {} : { top_p: sampling.topP }),
    ...(sampling.maxOutputTokens === undefined
      ? {}
      : { max_output_tokens: sampling.maxOutputTokens }),
  };
}

export function encodeRequest(request: HubRequest): Translated<ResponsesRequest> {
  const folded = encodeMessages(request.messages, request.sourceModel);
  const value: ResponsesRequest = { input: folded.items, ...encodeSampling(request.sampling) };

  if (request.system !== undefined) {
    const content = request.system.map((entry) => ({
      type: 'input_text' as const,
      text: entry.text,
    }));

    if (request.sourceModel === undefined)
      value.instructions = content.map((part) => part.text).join('\n');
    else value.input = [{ type: 'message', role: 'developer', content }, ...value.input];
  }

  toolsInto(value, request);

  if (request.toolChoice !== undefined) {
    value.tool_choice = toResponsesToolChoice(request.toolChoice);
  }

  responsesOptionsInto(value, request);

  return { value, fates: folded.fates };
}

function toolsInto(value: ResponsesRequest, request: HubRequest): void {
  if (request.tools !== undefined) {
    value.tools = request.tools.map(toResponsesTool);
  }

  if (request.serverTools !== undefined) {
    value.tools = [...(value.tools ?? []), ...request.serverTools.map(toResponsesWebSearchTool)];
  }
}

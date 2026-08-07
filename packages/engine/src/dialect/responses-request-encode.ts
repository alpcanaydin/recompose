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
  HubTool,
  HubToolChoice,
  HubToolResultBlock,
  HubToolUseBlock,
  HubVideoBlock,
  HubWebSearchTool,
} from './hub';
import type {
  ResponsesContentPart,
  ResponsesFunctionCallOutputItem,
  ResponsesInputItem,
  ResponsesRequest,
  ResponsesTool,
  ResponsesToolChoice,
  ResponsesToolParameters,
} from './responses-wire';

import { responsesItemsForGeminiToolUse } from './responses-gemini-carrier';
import { responsesPartFromHubBlock } from './responses-media-encode';
import { responsesOptionsInto } from './responses-request-options';
import {
  isCodexReasoningSignature,
  redactedThinkingDropFate,
  thinkingDropFate,
} from './responses-shared';

function toResponsesTool(tool: HubTool): ResponsesTool {
  const parameters: ResponsesToolParameters = {
    type: 'object',
    properties: tool.inputSchema.properties,
    ...(tool.inputSchema.required === undefined ? {} : { required: tool.inputSchema.required }),
  };

  return {
    type: 'function',
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    parameters,
  };
}

function toResponsesWebSearchTool(tool: HubWebSearchTool): ResponsesTool {
  return {
    type: 'web_search',
    ...(tool.allowedDomains === undefined
      ? {}
      : { filters: { allowed_domains: tool.allowedDomains } }),
    ...(tool.userLocation === undefined ? {} : { user_location: tool.userLocation }),
  };
}

function basicResponsesToolChoice(
  choice: Exclude<HubToolChoice, { type: 'web_search' }>,
): ResponsesToolChoice {
  switch (choice.type) {
    case 'auto':
      return 'auto';
    case 'none':
      return 'none';
    case 'required':
      return 'required';
    case 'tool':
      return { type: 'function', name: choice.name };

    default: {
      const unhandled: never = choice;

      throw new Error(`unhandled hub tool choice: ${JSON.stringify(unhandled)}`);
    }
  }
}

function toResponsesToolChoice(choice: HubToolChoice): ResponsesToolChoice {
  return choice.type === 'web_search' ? { type: 'web_search' } : basicResponsesToolChoice(choice);
}

function functionCallOutputItemOf(
  block: HubToolResultBlock,
  fates: Fate[],
): ResponsesFunctionCallOutputItem {
  if (block.content.some((part) => part.type === 'image')) {
    fates.push({
      field: 'tool_result_image',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  }

  const output = block.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('');

  return { type: 'function_call_output', call_id: block.toolUseId, output };
}

function itemsOfToolBlock(
  block: HubToolUseBlock | HubToolResultBlock,
  fates: Fate[],
): ResponsesInputItem[] {
  switch (block.type) {
    case 'tool_use':
      return responsesItemsForGeminiToolUse(block);
    case 'tool_result':
      return [functionCallOutputItemOf(block, fates)];

    default: {
      const unhandled: never = block;

      throw new Error(`unhandled hub tool block: ${JSON.stringify(unhandled)}`);
    }
  }
}

type FoldedInput = { items: ResponsesInputItem[]; fates: Fate[] };

type EncodeContext = {
  readonly role: 'user' | 'assistant';
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
  if (context.role !== 'assistant' || !isCodexReasoningSignature(block.signature)) {
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

function encodeMessage(message: HubMessage): FoldedInput {
  const context: EncodeContext = { role: message.role, parts: [], items: [], fates: [] };

  for (const block of message.content) {
    encodeBlockInto(block, context);
  }

  flushParts(context);

  return { items: context.items, fates: context.fates };
}

function encodeMessages(messages: readonly HubMessage[]): FoldedInput {
  const items: ResponsesInputItem[] = [];
  const fates: Fate[] = [];

  for (const message of messages) {
    const folded = encodeMessage(message);

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
  const folded = encodeMessages(request.messages);
  const value: ResponsesRequest = { input: folded.items, ...encodeSampling(request.sampling) };

  if (request.system !== undefined) {
    value.instructions = request.system.map((entry) => entry.text).join('\n');
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

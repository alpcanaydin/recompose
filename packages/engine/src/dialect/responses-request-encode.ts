import type { Fate, Translated } from './fates';
import type {
  HubImageBlock,
  HubImageSource,
  HubMessage,
  HubRequest,
  HubSampling,
  HubTextBlock,
  HubTool,
  HubToolChoice,
  HubToolResultBlock,
  HubToolUseBlock,
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

import { functionCallItemOf, redactedThinkingDropFate, thinkingDropFate } from './responses-shared';

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

function toResponsesToolChoice(choice: HubToolChoice): ResponsesToolChoice {
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

function imageUrlOf(source: HubImageSource): string {
  return source.type === 'url' ? source.url : `data:${source.mediaType};base64,${source.data}`;
}

function partOfBlock(
  role: 'user' | 'assistant',
  block: HubTextBlock | HubImageBlock,
): ResponsesContentPart {
  if (block.type === 'image') {
    return { type: 'input_image', image_url: imageUrlOf(block.source) };
  }

  return role === 'assistant'
    ? { type: 'output_text', text: block.text }
    : { type: 'input_text', text: block.text };
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

function itemOfToolBlock(
  block: HubToolUseBlock | HubToolResultBlock,
  fates: Fate[],
): ResponsesInputItem {
  switch (block.type) {
    case 'tool_use':
      return functionCallItemOf(block);
    case 'tool_result':
      return functionCallOutputItemOf(block, fates);

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

function encodeBlockInto(block: HubMessage['content'][number], context: EncodeContext): void {
  if (block.type === 'text' || block.type === 'image') {
    context.parts.push(partOfBlock(context.role, block));

    return;
  }

  if (block.type === 'thinking') {
    context.fates.push(thinkingDropFate());

    return;
  }

  if (block.type === 'redacted_thinking') {
    context.fates.push(redactedThinkingDropFate());

    return;
  }

  flushParts(context);
  context.items.push(itemOfToolBlock(block, context.fates));
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

  if (request.tools !== undefined) {
    value.tools = request.tools.map(toResponsesTool);
  }

  if (request.toolChoice !== undefined) {
    value.tool_choice = toResponsesToolChoice(request.toolChoice);
  }

  return { value, fates: folded.fates };
}

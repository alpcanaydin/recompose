import type {
  AnthropicMessage,
  AnthropicRequest,
  AnthropicTextBlock,
  AnthropicTool,
  AnthropicToolChoice,
} from './anthropic-wire';
import type { Fate, Translated } from './fates';
import type {
  HubMessage,
  HubRequest,
  HubSampling,
  HubSystemText,
  HubTool,
  HubToolChoice,
} from './hub';

import { wireBlockFrom, wireCacheControlOf } from './anthropic-blocks';
import { injectedMaxOutputTokensDefault } from './chat-completions-request';

function wireSystemOf(system: readonly HubSystemText[] | undefined): {
  system?: readonly AnthropicTextBlock[];
} {
  if (system === undefined || system.length === 0) {
    return {};
  }

  return {
    system: system.map((text) => ({
      type: 'text',
      text: text.text,
      ...wireCacheControlOf(text.cacheBreakpoint),
    })),
  };
}

function wireToolOf(tool: HubTool): AnthropicTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    input_schema: {
      type: 'object',
      properties: tool.inputSchema.properties,
      ...(tool.inputSchema.required === undefined ? {} : { required: tool.inputSchema.required }),
    },
  };
}

function wireToolsOf(tools: readonly HubTool[] | undefined): {
  tools?: readonly AnthropicTool[];
} {
  return tools === undefined ? {} : { tools: tools.map(wireToolOf) };
}

function namedWireChoice(choice: HubToolChoice): AnthropicToolChoice {
  switch (choice.type) {
    case 'auto':
      return { type: 'auto' };
    case 'none':
      return { type: 'none' };
    case 'required':
      return { type: 'any' };
    case 'tool':
      return { type: 'tool', name: choice.name };

    default: {
      const unknownChoice: never = choice;

      throw new Error(`encodeRequest met an unknown tool choice: ${JSON.stringify(unknownChoice)}`);
    }
  }
}

function wireToolChoiceOf(choice: HubToolChoice | undefined): {
  tool_choice?: AnthropicToolChoice;
} {
  return choice === undefined ? {} : { tool_choice: namedWireChoice(choice) };
}

function wireMaxTokensOf(sampling: HubSampling | undefined, fates: Fate[]): number {
  if (sampling?.maxOutputTokens === undefined) {
    fates.push({
      field: 'sampling.maxOutputTokens',
      disposition: 'mapped',
      to: 'max_tokens (default)',
    });

    return injectedMaxOutputTokensDefault;
  }

  return sampling.maxOutputTokens;
}

type WireSamplingFields = Pick<
  AnthropicRequest,
  'max_tokens' | 'temperature' | 'top_p' | 'stop_sequences'
>;

function wireSamplingOf(sampling: HubSampling | undefined, fates: Fate[]): WireSamplingFields {
  const ceiling = { max_tokens: wireMaxTokensOf(sampling, fates) };

  if (sampling === undefined) {
    return ceiling;
  }

  const { temperature, topP, stop } = sampling;

  return {
    ...ceiling,
    ...(temperature === undefined ? {} : { temperature }),
    ...(topP === undefined ? {} : { top_p: topP }),
    ...(stop === undefined ? {} : { stop_sequences: stop }),
  };
}

function wireMessageOf(message: HubMessage): AnthropicMessage {
  return { role: message.role, content: message.content.map(wireBlockFrom) };
}

export function encodeRequest(hub: HubRequest): Translated<AnthropicRequest> {
  const fates: Fate[] = [];

  const value: AnthropicRequest = {
    messages: hub.messages.map(wireMessageOf),
    ...wireSystemOf(hub.system),
    ...wireToolsOf(hub.tools),
    ...wireToolChoiceOf(hub.toolChoice),
    ...wireSamplingOf(hub.sampling, fates),
  };

  return { value, fates };
}

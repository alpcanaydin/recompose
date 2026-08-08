import type {
  AnthropicMessage,
  AnthropicRequest,
  AnthropicSystemBlock,
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
import { mergeAdjacentSameRole } from './hub-build';
import { anthropicToolSchema } from './tool-schema';

function wireSystemOf(system: readonly HubSystemText[] | undefined): {
  system?: readonly AnthropicSystemBlock[];
} {
  if (system === undefined || system.length === 0) {
    return {};
  }

  return {
    system: system.map((text) =>
      text.markerType === undefined
        ? {
            type: 'text',
            text: text.text,
            ...wireCacheControlOf(text.cacheBreakpoint),
          }
        : { type: text.markerType, ...wireCacheControlOf(text.cacheBreakpoint) },
    ),
  };
}

function wireToolOf(tool: HubTool): AnthropicTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    input_schema: anthropicToolSchema(tool.inputSchema),
    ...wireCacheControlOf(tool.cacheBreakpoint),
  };
}

function wireToolsOf(tools: readonly HubTool[] | undefined): {
  tools?: readonly AnthropicTool[];
} {
  return tools === undefined ? {} : { tools: tools.map(wireToolOf) };
}

function basicNamedWireChoice(
  choice: Exclude<HubToolChoice, { type: 'web_search' }>,
): AnthropicToolChoice {
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

function namedWireChoice(choice: HubToolChoice): AnthropicToolChoice {
  return choice.type === 'web_search' ? { type: 'auto' } : basicNamedWireChoice(choice);
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
    messages: mergeAdjacentSameRole(hub.messages).map(wireMessageOf),
    ...wireSystemOf(hub.system),
    ...wireToolsOf(hub.tools),
    ...wireToolChoiceOf(hub.toolChoice),
    ...wireSamplingOf(hub.sampling, fates),
  };

  return { value, fates };
}

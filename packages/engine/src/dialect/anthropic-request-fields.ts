import type {
  AnthropicRequest,
  AnthropicSystem,
  AnthropicTool,
  AnthropicToolChoice,
  AnthropicToolSchema,
} from './anthropic-wire';
import type { Fate } from './fates';
import type { HubSampling, HubSystemText, HubTool, HubToolChoice } from './hub';

import { hubBreakpointOf } from './anthropic-blocks';
import { anthropicDrops } from './anthropic-drops';
import { injectedMaxOutputTokensDefault } from './chat-completions-request';

export function systemFrom(
  system: AnthropicSystem | undefined,
  fates: Fate[],
): readonly HubSystemText[] | undefined {
  if (system === undefined) {
    return undefined;
  }

  fates.push({ field: 'system', disposition: 'carried' });

  if (typeof system === 'string') {
    return [{ text: system }];
  }

  return system.map((block) => ({ text: block.text, ...hubBreakpointOf(block.cache_control) }));
}

function hubToolFrom(tool: AnthropicTool, schema: AnthropicToolSchema): HubTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: {
      type: 'object',
      properties: schema.properties ?? {},
      ...(schema.required === undefined ? {} : { required: schema.required }),
    },
  };
}

export function toolsFrom(
  tools: readonly AnthropicTool[] | undefined,
  fates: Fate[],
): readonly HubTool[] | undefined {
  if (tools === undefined) {
    return undefined;
  }

  fates.push({ field: 'tools', disposition: 'carried' });

  const carried: HubTool[] = [];

  for (const tool of tools) {
    if (tool.input_schema === undefined) {
      fates.push({ field: 'tools[server]', disposition: 'mapped', to: 'absent' });
    } else {
      carried.push(hubToolFrom(tool, tool.input_schema));
    }
  }

  return carried;
}

function namedToolChoice(choice: AnthropicToolChoice): HubToolChoice {
  switch (choice.type) {
    case 'auto':
      return { type: 'auto' };
    case 'none':
      return { type: 'none' };
    case 'any':
      return { type: 'required' };
    case 'tool':
      return { type: 'tool', name: choice.name };

    default: {
      const unknownChoice: never = choice;

      throw new Error(`decodeRequest met an unknown tool choice: ${JSON.stringify(unknownChoice)}`);
    }
  }
}

export function toolChoiceFrom(
  choice: AnthropicToolChoice | undefined,
  fates: Fate[],
): HubToolChoice | undefined {
  if (choice === undefined) {
    return undefined;
  }

  fates.push({ field: 'tool_choice', disposition: 'mapped', to: 'toolChoice' });

  if (choice.disable_parallel_tool_use !== undefined) {
    fates.push({
      field: 'tool_choice.disable_parallel_tool_use',
      disposition: 'mapped',
      to: 'absent',
    });
  }

  return namedToolChoice(choice);
}

function maxTokensFrom(request: AnthropicRequest, fates: Fate[]): number {
  if (request.max_tokens === undefined) {
    fates.push({
      field: 'max_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens (default)',
    });

    return injectedMaxOutputTokensDefault;
  }

  fates.push({ field: 'max_tokens', disposition: 'mapped', to: 'sampling.maxOutputTokens' });

  return request.max_tokens;
}

type SamplingKnobs = {
  maxOutputTokens: number;
  temperature?: number;
  topP?: number;
  stop?: readonly string[];
};

export function samplingFrom(request: AnthropicRequest, fates: Fate[]): HubSampling {
  const { temperature, top_p: topP, stop_sequences: stop } = request;
  const knobs: SamplingKnobs = { maxOutputTokens: maxTokensFrom(request, fates) };

  if (temperature !== undefined) {
    fates.push({ field: 'temperature', disposition: 'mapped', to: 'sampling.temperature' });
    knobs.temperature = temperature;
  }

  if (topP !== undefined) {
    fates.push({ field: 'top_p', disposition: 'mapped', to: 'sampling.topP' });
    knobs.topP = topP;
  }

  if (stop !== undefined) {
    fates.push({ field: 'stop_sequences', disposition: 'mapped', to: 'sampling.stop' });
    knobs.stop = stop;
  }

  return knobs;
}

export function scanDrops(request: AnthropicRequest, fates: Fate[]): void {
  for (const field of anthropicDrops) {
    if (field in request) {
      fates.push({ field, disposition: 'mapped', to: 'absent' });
    }
  }
}

export function scanEnvelope(request: AnthropicRequest, fates: Fate[]): void {
  fates.push({ field: 'messages', disposition: 'mapped', to: 'messages' });

  if (request.model !== undefined) {
    fates.push({ field: 'model', disposition: 'carried' });
  }
}

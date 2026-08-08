import type {
  AnthropicRequest,
  AnthropicSystem,
  AnthropicTool,
  AnthropicToolChoice,
  AnthropicToolSchema,
} from './anthropic-wire';
import type { Fate } from './fates';
import type {
  HubReasoning,
  HubSampling,
  HubSystemText,
  HubTool,
  HubToolChoice,
  HubWebSearchTool,
} from './hub';

import { hubBreakpointOf } from './anthropic-blocks';
import { anthropicDrops } from './anthropic-drops';
import { injectedMaxOutputTokensDefault } from './chat-completions-request';
import { hubToolSchemaFrom } from './tool-schema';

export function systemFrom(
  system: AnthropicSystem | undefined,
  fates: Fate[],
): readonly HubSystemText[] | undefined {
  if (system === undefined) {
    return undefined;
  }

  fates.push({ field: 'system', disposition: 'carried' });

  if (typeof system === 'string') {
    return system === '' ? undefined : [{ text: system }];
  }

  const blocks = system.flatMap(systemBlock);

  return blocks.length === 0 ? undefined : blocks;
}

function systemBlock(block: Exclude<AnthropicSystem, string>[number]): HubSystemText[] {
  if ('text' in block && block.text.startsWith('x-anthropic-billing-header:')) return [];

  return [
    'text' in block && typeof block.text === 'string'
      ? { text: block.text, ...hubBreakpointOf(block.cache_control) }
      : { text: '', markerType: block.type, ...hubBreakpointOf(block.cache_control) },
  ];
}

function hubToolFrom(tool: AnthropicTool, schema: AnthropicToolSchema): HubTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: hubToolSchemaFrom(schema),
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
      if (!isWebSearchTool(tool)) {
        fates.push({ field: 'tools[server]', disposition: 'mapped', to: 'absent' });
      }
    } else {
      carried.push(hubToolFrom(tool, tool.input_schema));
    }
  }

  return carried;
}

function isWebSearchTool(tool: AnthropicTool): boolean {
  return tool.type === 'web_search_20250305' || tool.type === 'web_search_20260209';
}

export function serverToolsFrom(
  tools: readonly AnthropicTool[] | undefined,
  fates: Fate[],
): readonly HubWebSearchTool[] | undefined {
  if (tools === undefined) {
    return undefined;
  }

  const carried = tools.flatMap((tool): HubWebSearchTool[] =>
    isWebSearchTool(tool)
      ? [
          {
            type: 'web_search',
            name: tool.name,
            ...(tool.allowed_domains === undefined ? {} : { allowedDomains: tool.allowed_domains }),
            ...(tool.user_location === undefined ? {} : { userLocation: tool.user_location }),
            ...(tool.max_uses === undefined ? {} : { maxUses: tool.max_uses }),
          },
        ]
      : [],
  );

  if (carried.length > 0) {
    fates.push({ field: 'tools[server]', disposition: 'mapped', to: 'serverTools' });
  }

  return carried.length === 0 ? undefined : carried;
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
  serverTools: readonly HubWebSearchTool[] = [],
): HubToolChoice | undefined {
  if (choice === undefined) {
    return undefined;
  }

  fates.push({ field: 'tool_choice', disposition: 'mapped', to: 'toolChoice' });

  return choice.type === 'tool' && serverTools.some((tool) => tool.name === choice.name)
    ? { type: 'web_search' }
    : namedToolChoice(choice);
}

export function serviceTierFrom(request: AnthropicRequest, fates: Fate[]): 'priority' | undefined {
  const priority = request.speed === 'fast' || isPriorityTier(request.service_tier);

  if (request.speed !== undefined || request.service_tier !== undefined) {
    fates.push({ field: 'service_tier/speed', disposition: 'mapped', to: 'serviceTier' });
  }

  return priority ? 'priority' : undefined;
}

export function reasoningFrom(request: AnthropicRequest, fates: Fate[]): HubReasoning | undefined {
  const thinking = request.thinking;

  if (thinking === undefined || !['enabled', 'adaptive', 'auto'].includes(thinking.type)) {
    return undefined;
  }

  fates.push({ field: 'thinking', disposition: 'mapped', to: 'reasoning' });

  return {
    summary: 'auto',
    ...(thinking.budget_tokens === undefined ? {} : { budgetTokens: thinking.budget_tokens }),
  };
}

function isPriorityTier(value: unknown): boolean {
  return value === 'fast' || value === 'priority';
}

export function parallelToolCallsFrom(
  choice: AnthropicToolChoice | undefined,
  fates: Fate[],
): boolean | undefined {
  if (choice?.disable_parallel_tool_use === undefined) return undefined;

  fates.push({
    field: 'tool_choice.disable_parallel_tool_use',
    disposition: 'mapped',
    to: 'parallelToolCalls',
  });

  return !choice.disable_parallel_tool_use;
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

function droppedEnvelopeFate(drop: (typeof anthropicDrops)[number]): Fate {
  const dropped: Fate = { field: drop.field, disposition: 'mapped', to: 'absent' };

  return drop.costBearing ? { ...dropped, costBearing: true } : dropped;
}

export function scanDrops(request: AnthropicRequest, fates: Fate[]): void {
  const met = anthropicDrops.filter((drop) => drop.field in request);

  fates.push(...met.map(droppedEnvelopeFate));
}

export function scanEnvelope(request: AnthropicRequest, fates: Fate[]): void {
  fates.push({ field: 'messages', disposition: 'mapped', to: 'messages' });

  if (request.model !== undefined) {
    fates.push({ field: 'model', disposition: 'carried' });
  }
}

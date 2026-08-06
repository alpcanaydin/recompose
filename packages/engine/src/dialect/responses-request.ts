import type { TranslationRefusal } from '../refusals';
import type { Fate, TranslateResult } from './fates';
import type {
  HubMessage,
  HubRequest,
  HubSampling,
  HubTool,
  HubToolChoice,
  HubToolSchema,
  HubWebSearchTool,
} from './hub';
import type { ResponsesDrop } from './responses-drops';
import type {
  ResponsesFunctionCallItem,
  ResponsesFunctionCallOutputItem,
  ResponsesFunctionTool,
  ResponsesInputItem,
  ResponsesRequest,
  ResponsesTool,
  ResponsesToolChoice,
  ResponsesToolParameters,
} from './responses-wire';

import {
  emptyConversation,
  toolIdCollision,
  unrepairableToolCall,
  unsupportedField,
} from '../refusals';
import { mergeAdjacentSameRole } from './hub-build';
import { responsesRequestDrops } from './responses-drops';
import { foldReasoning } from './responses-reasoning-decode';
import { toHubContentBlocks, toolResultBlockOf, toolUseBlockOf } from './responses-shared';
import { firstToolIdCollision } from './tool-id';

function normalizeSchema(parameters: ResponsesToolParameters): HubToolSchema {
  return {
    type: 'object',
    properties: parameters.properties ?? {},
    ...(parameters.required === undefined ? {} : { required: parameters.required }),
  };
}

function toHubTool(tool: ResponsesFunctionTool): HubTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: normalizeSchema(tool.parameters),
  };
}

function toHubWebSearchTool(
  tool: Extract<ResponsesTool, { type: 'web_search' }>,
): HubWebSearchTool {
  return {
    type: 'web_search',
    name: 'web_search',
    ...(tool.filters === undefined ? {} : { allowedDomains: tool.filters.allowed_domains }),
    ...(tool.user_location === undefined ? {} : { userLocation: tool.user_location }),
  };
}

function toHubToolChoice(choice: ResponsesToolChoice): HubToolChoice {
  if (typeof choice === 'object') {
    return objectToolChoice(choice);
  }

  switch (choice) {
    case 'auto':
      return { type: 'auto' };
    case 'none':
      return { type: 'none' };
    case 'required':
      return { type: 'required' };

    default: {
      const unhandled: never = choice;

      throw new Error(`unhandled responses tool choice: ${String(unhandled)}`);
    }
  }
}

function objectToolChoice(
  choice: Extract<ResponsesToolChoice, object>,
): Extract<HubToolChoice, { type: 'tool' | 'web_search' }> {
  return choice.type === 'web_search'
    ? { type: 'web_search' }
    : { type: 'tool', name: choice.name };
}

function toHubSampling(request: ResponsesRequest): HubSampling | undefined {
  const sampling: { maxOutputTokens?: number; temperature?: number; topP?: number } = {};

  if (request.max_output_tokens !== undefined) {
    sampling.maxOutputTokens = request.max_output_tokens;
  }

  if (request.temperature !== undefined) {
    sampling.temperature = request.temperature;
  }

  if (request.top_p !== undefined) {
    sampling.topP = request.top_p;
  }

  return Object.keys(sampling).length > 0 ? sampling : undefined;
}

type FoldedItems = { messages: HubMessage[]; fates: Fate[] };

function foldFunctionCall(
  item: ResponsesFunctionCallItem,
  answeredCalls: ReadonlySet<string>,
): FoldedItems {
  if (answeredCalls.has(item.call_id)) {
    return { messages: [{ role: 'assistant', content: [toolUseBlockOf(item)] }], fates: [] };
  }

  return { messages: [], fates: [{ field: item.call_id, disposition: 'mapped', to: 'absent' }] };
}

function foldFunctionCallOutput(item: ResponsesFunctionCallOutputItem): FoldedItems {
  return { messages: [{ role: 'user', content: [toolResultBlockOf(item)] }], fates: [] };
}

function foldInputItem(item: ResponsesInputItem, answeredCalls: ReadonlySet<string>): FoldedItems {
  switch (item.type) {
    case 'message':
      return {
        messages: [{ role: item.role, content: toHubContentBlocks(item.content) }],
        fates: [],
      };
    case 'function_call':
      return foldFunctionCall(item, answeredCalls);
    case 'function_call_output':
      return foldFunctionCallOutput(item);
    case 'reasoning':
      return foldReasoning(item);

    default: {
      const unhandled: never = item;

      throw new Error(`unhandled responses input item: ${JSON.stringify(unhandled)}`);
    }
  }
}

const topLevelDestinations: readonly [keyof ResponsesRequest, string][] = [
  ['model', 'routing'],
  ['instructions', 'system'],
  ['tools', 'tools'],
  ['tool_choice', 'toolChoice'],
  ['temperature', 'sampling.temperature'],
  ['top_p', 'sampling.topP'],
  ['max_output_tokens', 'sampling.maxOutputTokens'],
];

function topLevelFates(request: ResponsesRequest): Fate[] {
  const named: Fate[] = [{ field: 'input', disposition: 'mapped', to: 'messages' }];

  for (const [field, to] of topLevelDestinations) {
    if (field in request) {
      named.push({ field, disposition: 'mapped', to });
    }
  }

  return named;
}

function dropFateOf(drop: ResponsesDrop): Fate {
  return {
    field: drop.field,
    disposition: 'mapped',
    to: 'absent',
    ...(drop.costBearing ? { costBearing: true } : {}),
  };
}

function dropFates(request: ResponsesRequest): Fate[] {
  return responsesRequestDrops.flatMap((drop) => (drop.field in request ? [dropFateOf(drop)] : []));
}

function answeredCallsOf(input: readonly ResponsesInputItem[]): Set<string> {
  const answered = new Set<string>();

  for (const item of input) {
    if (item.type === 'function_call_output') {
      answered.add(item.call_id);
    }
  }

  return answered;
}

function firstOutputViolation(input: readonly ResponsesInputItem[]): string | undefined {
  const standing = new Set<string>();

  for (const item of input) {
    if (item.type === 'function_call') {
      standing.add(item.call_id);
    }

    if (item.type === 'function_call_output' && !standing.delete(item.call_id)) {
      return item.call_id;
    }
  }

  return undefined;
}

function foldInput(request: ResponsesRequest): FoldedItems {
  const answeredCalls = answeredCallsOf(request.input);

  const messages: HubMessage[] = [];
  const fates: Fate[] = [];

  for (const item of request.input) {
    const outcome = foldInputItem(item, answeredCalls);

    messages.push(...outcome.messages);
    fates.push(...outcome.fates);
  }

  return { messages, fates };
}

function assembleHubRequest(
  request: ResponsesRequest,
  messages: readonly HubMessage[],
): HubRequest {
  const value: HubRequest = { messages };

  if (request.instructions !== undefined) {
    value.system = [{ text: request.instructions }];
  }

  if (request.tools !== undefined) {
    const tools = request.tools.filter(
      (tool): tool is ResponsesFunctionTool => tool.type === 'function',
    );
    const serverTools = request.tools.filter((tool) => tool.type === 'web_search');

    value.tools = tools.map(toHubTool);
    value.serverTools = serverTools.map(toHubWebSearchTool);
  }

  if (request.tool_choice !== undefined) {
    value.toolChoice = toHubToolChoice(request.tool_choice);
  }

  const sampling = toHubSampling(request);

  if (sampling !== undefined) {
    value.sampling = sampling;
  }

  return value;
}

function toolIdsOf(input: readonly ResponsesInputItem[]): string[] {
  return input.flatMap((item) =>
    item.type === 'function_call' || item.type === 'function_call_output' ? [item.call_id] : [],
  );
}

export function decodeRequest(
  request: ResponsesRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  if (request.previous_response_id !== undefined) {
    return { refusal: unsupportedField('previous_response_id') };
  }

  const collision = firstToolIdCollision(toolIdsOf(request.input));

  if (collision !== undefined) {
    return { refusal: toolIdCollision(collision) };
  }

  const violation = firstOutputViolation(request.input);

  if (violation !== undefined) {
    return { refusal: unrepairableToolCall(violation) };
  }

  const folded = foldInput(request);
  const messages = mergeAdjacentSameRole(folded.messages);

  if (messages.length === 0) {
    return { refusal: emptyConversation() };
  }

  const value = assembleHubRequest(request, messages);
  const fates: Fate[] = [...topLevelFates(request), ...dropFates(request), ...folded.fates];

  return { value, fates };
}

import type { TranslationRefusal } from '../refusals';
import type { Fate, TranslateResult } from './fates';
import type {
  HubMessage,
  HubRequest,
  HubSampling,
  HubTool,
  HubToolChoice,
  HubToolSchema,
} from './hub';
import type { ResponsesDrop } from './responses-drops';
import type {
  ResponsesFunctionCallItem,
  ResponsesFunctionCallOutputItem,
  ResponsesInputItem,
  ResponsesReasoningItem,
  ResponsesRequest,
  ResponsesTool,
  ResponsesToolChoice,
  ResponsesToolParameters,
} from './responses-wire';

import { unrepairableToolCall, unsupportedField } from '../refusals';
import { responsesRequestDrops } from './responses-drops';
import {
  thinkingBlockOf,
  toHubContentBlocks,
  toolResultBlockOf,
  toolUseBlockOf,
} from './responses-shared';

function normalizeSchema(parameters: ResponsesToolParameters): HubToolSchema {
  return {
    type: 'object',
    properties: parameters.properties ?? {},
    ...(parameters.required === undefined ? {} : { required: parameters.required }),
  };
}

function toHubTool(tool: ResponsesTool): HubTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: normalizeSchema(tool.parameters),
  };
}

function toHubToolChoice(choice: ResponsesToolChoice): HubToolChoice {
  if (typeof choice === 'object') {
    return { type: 'tool', name: choice.name };
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

type ItemOutcome = FoldedItems | { refusal: TranslationRefusal };

function foldFunctionCall(
  item: ResponsesFunctionCallItem,
  answeredCalls: ReadonlySet<string>,
): FoldedItems {
  if (answeredCalls.has(item.call_id)) {
    return { messages: [{ role: 'assistant', content: [toolUseBlockOf(item)] }], fates: [] };
  }

  return { messages: [], fates: [{ field: item.call_id, disposition: 'mapped', to: 'absent' }] };
}

function foldFunctionCallOutput(
  item: ResponsesFunctionCallOutputItem,
  standingCalls: ReadonlySet<string>,
): ItemOutcome {
  if (!standingCalls.has(item.call_id)) {
    return { refusal: unrepairableToolCall(item.call_id) };
  }

  return { messages: [{ role: 'user', content: [toolResultBlockOf(item)] }], fates: [] };
}

function foldReasoning(item: ResponsesReasoningItem): FoldedItems {
  const traced: Fate[] =
    item.encrypted_content === undefined
      ? []
      : [{ field: 'encrypted_content', disposition: 'mapped', to: 'absent' }];

  return { messages: [{ role: 'assistant', content: [thinkingBlockOf(item)] }], fates: traced };
}

function foldInputItem(
  item: ResponsesInputItem,
  answeredCalls: ReadonlySet<string>,
  standingCalls: ReadonlySet<string>,
): ItemOutcome {
  switch (item.type) {
    case 'message':
      return {
        messages: [{ role: item.role, content: toHubContentBlocks(item.content) }],
        fates: [],
      };
    case 'function_call':
      return foldFunctionCall(item, answeredCalls);
    case 'function_call_output':
      return foldFunctionCallOutput(item, standingCalls);
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

function callSetsOf(input: readonly ResponsesInputItem[]): {
  standingCalls: Set<string>;
  answeredCalls: Set<string>;
} {
  const standingCalls = new Set<string>();
  const answeredCalls = new Set<string>();

  for (const item of input) {
    if (item.type === 'function_call') {
      standingCalls.add(item.call_id);
    }

    if (item.type === 'function_call_output') {
      answeredCalls.add(item.call_id);
    }
  }

  return { standingCalls, answeredCalls };
}

function foldInput(request: ResponsesRequest): ItemOutcome {
  const { standingCalls, answeredCalls } = callSetsOf(request.input);

  const messages: HubMessage[] = [];
  const fates: Fate[] = [];

  for (const item of request.input) {
    const outcome = foldInputItem(item, answeredCalls, standingCalls);

    if ('refusal' in outcome) {
      return outcome;
    }

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
    value.tools = request.tools.map(toHubTool);
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

export function decodeRequest(
  request: ResponsesRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  if (request.previous_response_id !== undefined) {
    return { refusal: unsupportedField('previous_response_id') };
  }

  const folded = foldInput(request);

  if ('refusal' in folded) {
    return folded;
  }

  const value = assembleHubRequest(request, folded.messages);
  const fates: Fate[] = [...topLevelFates(request), ...dropFates(request), ...folded.fates];

  return { value, fates };
}

import type { TranslationRefusal } from '../refusals';
import type { Fate, TranslateResult } from './fates';
import type {
  HubMessage,
  HubRequest,
  HubSampling,
  HubTool,
  HubToolChoice,
  HubWebSearchTool,
} from './hub';
import type {
  ResponsesFunctionCallItem,
  ResponsesFunctionCallOutputItem,
  ResponsesFunctionTool,
  ResponsesInputItem,
  ResponsesRequest,
  ResponsesTool,
  ResponsesToolChoice,
} from './responses-wire';

import { emptyConversation, toolIdCollision, unrepairableToolCall } from '../refusals';
import { mergeAdjacentSameRole } from './hub-build';
import {
  mergeResponsesMessagesForChat,
  restoreResponsesChatToolIds,
} from './responses-chat-decode';
import { isResponsesExtensionItem, normalizeResponsesExtensions } from './responses-extended-tools';
import { foldResponsesInputWithGeminiCarriers } from './responses-gemini-carrier';
import { responsesMessageContent } from './responses-message';
import { foldReasoning } from './responses-reasoning-decode';
import { responsesDropFates, responsesTopLevelFates } from './responses-request-fates';
import { responsesHistory } from './responses-request-history';
import { hubOptionsFromResponses } from './responses-request-options';
import { toolUseBlockOf } from './responses-shared';
import { isResponsesSystemMessage, responsesSystem } from './responses-system';
import { toolResultBlockOf } from './responses-tool-result';
import { responsesToolChoiceName } from './responses-tools-wire';
import { strictHubToolSchemaFrom } from './tool-schema';

function toHubTool(tool: ResponsesFunctionTool): HubTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: strictHubToolSchemaFrom(tool.parameters),
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
    : { type: 'tool', name: responsesToolChoiceName(choice) };
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
type FoldContext = {
  answeredCalls: ReadonlySet<string>;
  callNames: ReadonlyMap<string, string>;
  preserveIncompatibleReasoning: boolean;
  preserveDanglingCalls: boolean;
};

function foldFunctionCall(item: ResponsesFunctionCallItem, context: FoldContext): FoldedItems {
  if (context.answeredCalls.has(item.call_id) || context.preserveDanglingCalls) {
    return { messages: [{ role: 'assistant', content: [toolUseBlockOf(item)] }], fates: [] };
  }

  return { messages: [], fates: [{ field: item.call_id, disposition: 'mapped', to: 'absent' }] };
}

function foldFunctionCallOutput(
  item: ResponsesFunctionCallOutputItem,
  context: FoldContext,
): FoldedItems {
  const block = toolResultBlockOf(item, context.callNames.get(item.call_id));

  return { messages: [{ role: 'user', content: [block] }], fates: [] };
}

function foldInputItem(item: ResponsesInputItem, context: FoldContext): FoldedItems {
  if (isResponsesExtensionItem(item)) return { messages: [], fates: [] };

  return foldCoreInputItem(item, context);
}

function foldCoreInputItem(
  item: Exclude<
    ResponsesInputItem,
    { type: 'additional_tools' | 'custom_tool_call' | 'custom_tool_call_output' }
  >,
  context: FoldContext,
): FoldedItems {
  switch (item.type) {
    case 'message':
      return foldMessageItem(item);
    case 'function_call':
      return foldFunctionCall(item, context);
    case 'function_call_output':
      return foldFunctionCallOutput(item, context);
    case 'reasoning':
      return foldReasoning(item, context.preserveIncompatibleReasoning);

    default: {
      const unhandled: never = item;

      throw new Error(`unhandled responses input item: ${JSON.stringify(unhandled)}`);
    }
  }
}

function foldMessageItem(item: Extract<ResponsesInputItem, { type: 'message' }>): FoldedItems {
  if (isResponsesSystemMessage(item)) return { messages: [], fates: [] };
  if (item.role !== 'user' && item.role !== 'assistant') return { messages: [], fates: [] };

  return {
    messages: [{ role: item.role, content: responsesMessageContent(item) }],
    fates: [],
  };
}

function foldInput(
  request: ResponsesRequest,
  preserveIncompatibleReasoning: boolean,
  preserveDanglingCalls: boolean,
): FoldedItems {
  const history = responsesHistory(request.input);
  const context: FoldContext = { ...history, preserveIncompatibleReasoning, preserveDanglingCalls };

  return foldResponsesInputWithGeminiCarriers(
    request.input,
    context.answeredCalls,
    context.preserveDanglingCalls,
    (item) => foldInputItem(item, context),
  );
}

function assembleHubRequest(
  request: ResponsesRequest,
  messages: readonly HubMessage[],
  system: HubRequest['system'],
): HubRequest {
  const value: HubRequest = { messages, ...hubOptionsFromResponses(request) };

  if (system !== undefined) value.system = system;

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

export function decodeRequest(
  request: ResponsesRequest,
  preserveIncompatibleReasoning = false,
  preserveDanglingCalls = false,
): TranslateResult<HubRequest, TranslationRefusal> {
  const normalized = normalizeResponsesExtensions(request);
  const history = responsesHistory(normalized.input);
  const refusal = historyRefusal(history);

  if (refusal !== undefined) return { refusal };

  const folded = foldInput(normalized, preserveIncompatibleReasoning, preserveDanglingCalls);
  const system = responsesSystem(normalized);
  const messages = finalizedMessages(folded.messages, system, preserveDanglingCalls);

  if (messages.length === 0) {
    return { refusal: emptyConversation() };
  }

  const value = assembleHubRequest(normalized, messages, system);
  const fates: Fate[] = [
    ...responsesTopLevelFates(request),
    ...responsesDropFates(request),
    ...folded.fates,
  ];

  return { value, fates };
}

function finalizedMessages(
  source: readonly HubMessage[],
  system: HubRequest['system'],
  preserveUserBoundaries: boolean,
): HubMessage[] {
  const messages = preserveUserBoundaries
    ? mergeResponsesMessagesForChat(source)
    : mergeAdjacentSameRole(source);

  if (messages.length === 0 && system !== undefined) {
    messages.push({ role: 'user', content: [{ type: 'text', text: '' }] });
  }

  return messages;
}

export function decodeRequestWithCompat(
  request: ResponsesRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  return decodeRequest(request, true);
}

export function decodeRequestForChat(
  request: ResponsesRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  const decoded = decodeRequest(request, true, true);

  if ('refusal' in decoded) return decoded;

  return { ...decoded, value: restoreResponsesChatToolIds(decoded.value, request) };
}

function historyRefusal(
  history: ReturnType<typeof responsesHistory>,
): TranslationRefusal | undefined {
  if (history.collision !== undefined) return toolIdCollision(history.collision);
  if (history.unmatchedOutput !== undefined) return unrepairableToolCall(history.unmatchedOutput);

  return undefined;
}

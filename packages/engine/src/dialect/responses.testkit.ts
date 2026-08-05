import type { TranslationRefusal } from '../refusals';
import type { Fate, Translated } from './fates';
import type {
  HubContentBlock,
  HubMessage,
  HubThinkingBlock,
  HubToolResultBlock,
  HubToolUseBlock,
} from './hub';
import type {
  ResponsesFunctionCallItem,
  ResponsesFunctionCallOutputItem,
  ResponsesMessageItem,
  ResponsesReasoningItem,
  ResponsesRequest,
  ResponsesTool,
} from './responses-wire';

export function expectTranslation<T>(
  result: Translated<T> | { refusal: TranslationRefusal },
): Translated<T> {
  if ('refusal' in result) {
    throw new Error(`expected a translation, got a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result;
}

export function expectRefusal(
  result: Translated<unknown> | { refusal: TranslationRefusal },
): TranslationRefusal {
  if (!('refusal' in result)) {
    throw new Error('expected a refusal, got a translation');
  }

  return result.refusal;
}

export function fateFor(fates: readonly Fate[], field: string): Fate {
  const found = fates.find((fate) => fate.field === field);

  if (found === undefined) {
    throw new Error(`no fate names the field "${field}"`);
  }

  return found;
}

function contentOf(messages: readonly HubMessage[]): HubContentBlock[] {
  return messages.flatMap((message) => [...message.content]);
}

export function toolUsesOf(messages: readonly HubMessage[]): HubToolUseBlock[] {
  return contentOf(messages).filter((block): block is HubToolUseBlock => block.type === 'tool_use');
}

export function toolResultsOf(messages: readonly HubMessage[]): HubToolResultBlock[] {
  return contentOf(messages).filter(
    (block): block is HubToolResultBlock => block.type === 'tool_result',
  );
}

export function thinkingOf(messages: readonly HubMessage[]): HubThinkingBlock[] {
  return contentOf(messages).filter(
    (block): block is HubThinkingBlock => block.type === 'thinking',
  );
}

export function aResponsesUserMessage(
  text = 'What is the weather in Paris?',
): ResponsesMessageItem {
  return { type: 'message', role: 'user', content: [{ type: 'input_text', text }] };
}

export function aResponsesFunctionCall(
  overrides: Partial<ResponsesFunctionCallItem> = {},
): ResponsesFunctionCallItem {
  return {
    type: 'function_call',
    call_id: 'call_weather',
    name: 'get_weather',
    arguments: '{"city":"Paris"}',
    ...overrides,
  };
}

export function aResponsesFunctionCallOutput(
  overrides: Partial<ResponsesFunctionCallOutputItem> = {},
): ResponsesFunctionCallOutputItem {
  return {
    type: 'function_call_output',
    call_id: 'call_weather',
    output: 'sunny, 21C',
    ...overrides,
  };
}

export function aResponsesReasoningItem(
  overrides: Partial<ResponsesReasoningItem> = {},
): ResponsesReasoningItem {
  return {
    type: 'reasoning',
    id: 'rs_1',
    summary: [{ type: 'summary_text', text: 'weigh the two routes before answering' }],
    ...overrides,
  };
}

export function aResponsesTool(overrides: Partial<ResponsesTool> = {}): ResponsesTool {
  return {
    type: 'function',
    name: 'get_weather',
    description: 'Look up the weather for a city',
    parameters: { type: 'object', properties: { city: { type: 'string' } } },
    ...overrides,
  };
}

export function aResponsesRequest(overrides: Partial<ResponsesRequest> = {}): ResponsesRequest {
  return { input: [aResponsesUserMessage()], ...overrides };
}

export function aCodexRequestWithTools(
  overrides: Partial<ResponsesRequest> = {},
): ResponsesRequest {
  return {
    model: 'gpt-5',
    instructions: 'You answer concisely.',
    input: [aResponsesUserMessage()],
    tools: [aResponsesTool()],
    tool_choice: 'auto',
    ...overrides,
  };
}

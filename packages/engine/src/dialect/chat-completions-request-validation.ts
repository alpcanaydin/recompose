import type { TranslationRefusal } from '../refusals';
import type { ChatMessage } from './chat-completions-wire';

import { toolIdCollision, unrepairableToolCall } from '../refusals';
import { firstToolIdCollision } from './tool-id';

function callAndResultIds(messages: readonly ChatMessage[]): {
  callIds: Set<string>;
  resultIds: Set<string>;
} {
  const callIds = new Set<string>();
  const resultIds = new Set<string>();

  for (const message of messages) collectMessageIds(message, callIds, resultIds);

  return { callIds, resultIds };
}

function collectMessageIds(
  message: ChatMessage,
  callIds: Set<string>,
  resultIds: Set<string>,
): void {
  collectCallIds(message, callIds);
  collectResultId(message, resultIds);
}

function collectCallIds(message: ChatMessage, callIds: Set<string>): void {
  if (message.role !== 'assistant') return;
  for (const call of message.tool_calls ?? []) if (call.id !== undefined) callIds.add(call.id);
}

function collectResultId(message: ChatMessage, resultIds: Set<string>): void {
  if (message.role === 'tool' && message.tool_call_id !== undefined)
    resultIds.add(message.tool_call_id);
}

function recordStandingCalls(message: ChatMessage, standing: Set<string>): void {
  if (message.role !== 'assistant') return;

  for (const call of message.tool_calls ?? []) if (call.id !== undefined) standing.add(call.id);
}

function unmatchedResult(message: ChatMessage, standing: Set<string>): string | undefined {
  return message.role === 'tool' &&
    message.tool_call_id !== undefined &&
    !standing.delete(message.tool_call_id)
    ? message.tool_call_id
    : undefined;
}

function firstToolHistoryViolation(messages: readonly ChatMessage[]): string | undefined {
  const standing = new Set<string>();

  for (const message of messages) {
    recordStandingCalls(message, standing);
    const unmatched = unmatchedResult(message, standing);

    if (unmatched !== undefined) return unmatched;
  }

  return undefined;
}

export function chatRequestViolation(messages: readonly ChatMessage[]): {
  refusal?: TranslationRefusal;
  resultIds: Set<string>;
} {
  const { callIds, resultIds } = callAndResultIds(messages);
  const unmatched = firstToolHistoryViolation(messages);

  if (unmatched !== undefined) return { refusal: unrepairableToolCall(unmatched), resultIds };

  const collision = firstToolIdCollision([...callIds, ...resultIds]);

  return collision === undefined
    ? { resultIds }
    : { refusal: toolIdCollision(collision), resultIds };
}

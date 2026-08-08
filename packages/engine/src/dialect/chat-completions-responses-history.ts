import type {
  ChatAssistantMessage,
  ChatCompletionsRequest,
  ChatMessage,
  ChatToolCall,
  ChatToolMessage,
} from './chat-completions-wire';

type Pending = { id: string; matched: boolean };
type State = { blocked: Set<string>; pending: Pending[]; synthetic: number };

function normalizedCall(
  call: ChatToolCall | NonNullable<ChatAssistantMessage['tool_calls']>[number],
  state: State,
): typeof call {
  if (call.id !== undefined && call.id !== '') return call;
  const id = `call_synthetic_${String(state.synthetic++)}`;

  return { ...call, id };
}

function duplicateIds(
  calls: readonly NonNullable<ChatAssistantMessage['tool_calls']>[number][],
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const call of calls) {
    if (call.id === undefined) continue;
    if (seen.has(call.id)) duplicates.add(call.id);
    else seen.add(call.id);
  }

  return duplicates;
}

function assistant(message: ChatAssistantMessage, state: State): ChatAssistantMessage {
  const normalized = (message.tool_calls ?? []).map((call) => normalizedCall(call, state));
  const duplicates = duplicateIds(normalized);
  const toolCalls = normalized.filter((call) => call.id !== undefined && !duplicates.has(call.id));

  recordCalls(state, duplicates, toolCalls);

  return toolCalls.length === 0
    ? { ...message, tool_calls: [] }
    : { ...message, tool_calls: toolCalls };
}

function recordCalls(
  state: State,
  duplicates: ReadonlySet<string>,
  calls: readonly NonNullable<ChatAssistantMessage['tool_calls']>[number][],
): void {
  for (const id of duplicates) state.blocked.add(id);
  for (const call of calls) state.pending.push({ id: call.id ?? '', matched: false });
}

function pendingFor(message: ChatToolMessage, state: State): Pending | undefined {
  if (message.tool_call_id !== undefined) {
    return state.pending.findLast((entry) => entry.id === message.tool_call_id && !entry.matched);
  }

  return state.pending.find((entry) => !entry.matched && !state.blocked.has(entry.id));
}

function toolMessage(message: ChatToolMessage, state: State): ChatToolMessage | null {
  if (message.tool_call_id !== undefined && state.blocked.has(message.tool_call_id)) return null;
  const pending = pendingFor(message, state);

  if (pending === undefined) return null;
  pending.matched = true;

  return { ...message, tool_call_id: pending.id };
}

function normalizedMessage(message: ChatMessage, state: State): ChatMessage | null {
  if (message.role === 'assistant') return assistant(message, state);
  if (message.role === 'tool') return toolMessage(message, state);

  return message;
}

export function normalizeChatHistoryForResponses(
  request: ChatCompletionsRequest,
): ChatCompletionsRequest {
  const state: State = { blocked: new Set(), pending: [], synthetic: 0 };
  const messages = request.messages.flatMap((message) => {
    const normalized = normalizedMessage(message, state);

    return normalized === null ? [] : [normalized];
  });

  return { ...request, messages };
}

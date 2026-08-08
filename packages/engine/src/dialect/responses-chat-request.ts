import type { HubMessage, HubRequest, HubToolResultBlock, HubToolUseBlock } from './hub';

function toolUses(message: HubMessage): HubToolUseBlock[] {
  return message.content.filter((block): block is HubToolUseBlock => block.type === 'tool_use');
}

function toolResults(messages: readonly HubMessage[]): Map<string, HubToolResultBlock> {
  const results = new Map<string, HubToolResultBlock>();

  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'tool_result') results.set(block.toolUseId, block);
    }
  }

  return results;
}

function withoutToolResults(message: HubMessage): HubMessage | null {
  const content = message.content.filter((block) => block.type !== 'tool_result');

  return content.length === 0 ? null : { ...message, content };
}

export function orderResponsesToolResultsForChat(messages: readonly HubMessage[]): HubMessage[] {
  const results = toolResults(messages);
  const consumed = new Set<string>();
  const ordered: HubMessage[] = [];

  for (const message of messages) {
    if (message.role === 'assistant') {
      ordered.push(message);
      appendToolResults(message, results, consumed, ordered);

      continue;
    }

    const remaining = withoutToolResults(message);

    if (remaining !== null) ordered.push(remaining);
  }

  return ordered;
}

export function omitOrphanToolSettingsForChat(request: HubRequest): HubRequest {
  if (request.tools !== undefined && request.tools.length > 0) return request;

  const {
    toolChoice: _toolChoice,
    parallelToolCalls: _parallelToolCalls,
    tools: _tools,
    ...withoutTools
  } = request;

  return withoutTools;
}

function appendToolResults(
  message: HubMessage,
  results: ReadonlyMap<string, HubToolResultBlock>,
  consumed: Set<string>,
  ordered: HubMessage[],
): void {
  for (const call of toolUses(message)) {
    const result = results.get(call.id);

    if (result === undefined || consumed.has(call.id)) continue;

    consumed.add(call.id);
    ordered.push({ role: 'user', content: [result] });
  }
}

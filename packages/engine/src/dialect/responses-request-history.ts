import type { ResponsesInputItem } from './responses-wire';

import { firstToolIdCollision } from './tool-id';

export type ResponsesHistory = {
  answeredCalls: ReadonlySet<string>;
  callNames: ReadonlyMap<string, string>;
  collision?: string;
  unmatchedOutput?: string;
};

type MutableHistory = {
  answeredCalls: Set<string>;
  callNames: Map<string, string>;
  standing: Set<string>;
  ids: string[];
  unmatchedOutput: string | undefined;
};

function recordCall(
  history: MutableHistory,
  item: Extract<ResponsesInputItem, { type: 'function_call' }>,
): void {
  history.callNames.set(item.call_id, item.name);
  history.standing.add(item.call_id);
  history.ids.push(item.call_id);
}

function recordOutput(
  history: MutableHistory,
  item: Extract<ResponsesInputItem, { type: 'function_call_output' }>,
): void {
  history.answeredCalls.add(item.call_id);
  history.ids.push(item.call_id);
  if (!history.standing.delete(item.call_id)) history.unmatchedOutput ??= item.call_id;
}

function recordItem(history: MutableHistory, item: ResponsesInputItem): void {
  if (item.type === 'function_call') recordCall(history, item);
  if (item.type === 'function_call_output') recordOutput(history, item);
}

export function responsesHistory(input: readonly ResponsesInputItem[]): ResponsesHistory {
  const history: MutableHistory = {
    answeredCalls: new Set(),
    callNames: new Map(),
    standing: new Set(),
    ids: [],
    unmatchedOutput: undefined,
  };

  for (const item of input) recordItem(history, item);

  const collision = firstToolIdCollision(history.ids);

  return {
    answeredCalls: history.answeredCalls,
    callNames: history.callNames,
    ...(collision === undefined ? {} : { collision }),
    ...(history.unmatchedOutput === undefined ? {} : { unmatchedOutput: history.unmatchedOutput }),
  };
}

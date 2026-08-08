import type { ResponsesInputItem } from './responses-wire';

function callOrder(input: readonly ResponsesInputItem[]): ReadonlyMap<string, number> {
  const order = new Map<string, number>();

  for (const item of input) {
    if (item.type === 'function_call' && !order.has(item.call_id)) {
      order.set(item.call_id, order.size);
    }
  }

  return order;
}

function outputRank(item: ResponsesInputItem, order: ReadonlyMap<string, number>): number {
  return item.type === 'function_call_output'
    ? (order.get(item.call_id) ?? order.size)
    : order.size;
}

function outputRunEnd(input: readonly ResponsesInputItem[], start: number): number {
  let end = start;

  while (input[end]?.type === 'function_call_output') end += 1;

  return end;
}

function orderedOutputs(input: readonly ResponsesInputItem[]): ResponsesInputItem[] {
  const order = callOrder(input);
  const output: ResponsesInputItem[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];

    if (item?.type !== 'function_call_output') {
      if (item !== undefined) output.push(item);

      continue;
    }

    const end = outputRunEnd(input, index);
    const run = input.slice(index, end);

    output.push(
      ...run.toSorted((left, right) => outputRank(left, order) - outputRank(right, order)),
    );
    index = end - 1;
  }

  return output;
}

function withoutUnmatchedOutputs(input: readonly ResponsesInputItem[]): ResponsesInputItem[] {
  const calls = new Set(
    input.flatMap((item) => (item.type === 'function_call' ? [item.call_id] : [])),
  );

  return input.filter((item) => item.type !== 'function_call_output' || calls.has(item.call_id));
}

export function normalizeGeminiOutputOrder(
  input: readonly ResponsesInputItem[],
): ResponsesInputItem[] {
  return orderedOutputs(withoutUnmatchedOutputs(input));
}

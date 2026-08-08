import type { ResponsesToolRef } from './responses-extended-tools';
import type { ResponsesCustomToolOutputItem, ResponsesOutputItem } from './responses-wire';

export function customToolInput(argumentsJson: string): string {
  const parsed = parsedJson(argumentsJson);

  if (parsed === null) return argumentsJson;
  if (!isJsonObject(parsed)) return '';

  return typeof parsed['input'] === 'string' ? parsed['input'] : '';
}

function parsedJson(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);

    return parsed;
  } catch {
    return null;
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function restoredItem(
  item: ResponsesOutputItem,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesOutputItem {
  if (item.type !== 'function_call') return item;

  const ref = responseToolRef(item.name, refs);

  if (ref === undefined) return item;
  if (ref.kind === 'namespace') return { ...item, name: ref.name, namespace: ref.namespace };

  const custom: ResponsesCustomToolOutputItem = {
    type: 'custom_tool_call',
    id: `ctc_${item.call_id}`,
    call_id: item.call_id,
    name: ref.name,
    input: customToolInput(item.arguments),
  };

  return custom;
}

export function responseToolRef(
  name: string | undefined,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): ResponsesToolRef | undefined {
  if (name !== undefined && name !== '') return refs[name];

  const values = Object.values(refs);

  return values.length === 1 ? values[0] : undefined;
}

export function restoreResponsesToolResponse<T extends { output: readonly ResponsesOutputItem[] }>(
  response: T,
  refs: Readonly<Record<string, ResponsesToolRef>>,
): T {
  return { ...response, output: response.output.map((item) => restoredItem(item, refs)) };
}

import type {
  ResponsesCustomTool,
  ResponsesFunctionTool,
  ResponsesInputItem,
  ResponsesNamespaceTool,
  ResponsesRequest,
  ResponsesTool,
  ResponsesToolChoice,
} from './responses-wire';

import { responsesToolChoiceName } from './responses-tools-wire';

export type ResponsesToolRef =
  | { kind: 'custom'; name: string }
  | { kind: 'namespace'; namespace: string; name: string };

type Candidate = { tool: ResponsesTool; priority: number; order: number; ref?: ResponsesToolRef };
type NamespaceRef = { namespace: string; child: string; qualified: string };

export function qualifyResponsesToolName(namespace: string, child: string): string {
  const parent = namespace.trim().replace(/__+$/u, '');
  const name = child.trim();

  if (parent === '' || name.startsWith(`${parent}__`)) return name;

  return `${parent}__${name}`;
}

function customFunction(tool: ResponsesCustomTool): ResponsesFunctionTool | null {
  if (tool.name === 'apply_patch') return null;

  return {
    type: 'function',
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    parameters: {
      type: 'object',
      properties: { input: { type: 'string' } },
      required: ['input'],
    },
  };
}

function namespaceCandidates(
  tool: ResponsesNamespaceTool,
  priority: number,
  order: number,
  refs: NamespaceRef[],
): Candidate[] {
  return tool.tools.flatMap((child, index) =>
    namespaceChildCandidate(tool.name, child, priority, order + index, refs),
  );
}

function namespaceChildCandidate(
  namespace: string,
  child: ResponsesTool,
  priority: number,
  order: number,
  refs: NamespaceRef[],
): Candidate[] {
  if (child.type !== 'function' && child.type !== 'custom') return [];

  const qualified = qualifyResponsesToolName(namespace, child.name);

  refs.push({ namespace, child: child.name, qualified });

  const ref: ResponsesToolRef = { kind: 'namespace', namespace, name: child.name };

  if (child.type === 'function') {
    return [{ tool: { ...child, name: qualified }, priority, order, ref }];
  }

  const normalized = customFunction(child);

  return normalized === null
    ? []
    : [{ tool: { ...normalized, name: qualified }, priority, order, ref }];
}

function candidatesOf(
  tools: readonly ResponsesTool[],
  priority: number,
  start: number,
  refs: NamespaceRef[],
): Candidate[] {
  return tools.flatMap((tool, index) => {
    const order = start + index;

    if (tool.type === 'namespace') return namespaceCandidates(tool, priority - 1, order, refs);

    if (tool.type === 'custom') {
      const normalized = customFunction(tool);

      return normalized === null
        ? []
        : [{ tool: normalized, priority, order, ref: { kind: 'custom', name: tool.name } }];
    }

    return [{ tool, priority, order }];
  });
}

function toolKey(tool: ResponsesTool): string {
  return tool.type === 'web_search' ? 'web_search' : tool.name;
}

function selectedTools(candidates: readonly Candidate[]): ResponsesTool[] {
  return selectedCandidates(candidates).map(({ tool }) => tool);
}

function selectedCandidates(candidates: readonly Candidate[]): Candidate[] {
  const selected = new Map<string, Candidate>();

  for (const candidate of candidates) {
    const key = toolKey(candidate.tool);
    const current = selected.get(key);

    if (current === undefined || candidate.priority > current.priority)
      selected.set(key, candidate);
  }

  return [...selected.values()].toSorted((left, right) => left.order - right.order);
}

function additionalTools(input: readonly ResponsesInputItem[]): ResponsesTool[] {
  return input.flatMap((item) => (item.type === 'additional_tools' ? item.tools : []));
}

function customArguments(input: unknown): string {
  if (input === undefined) return '{}';
  if (typeof input === 'string') return JSON.stringify({ input });

  return JSON.stringify(input);
}

function normalizedInputItem(
  item: ResponsesInputItem,
  refs: readonly NamespaceRef[],
): ResponsesInputItem[] {
  if (item.type === 'additional_tools') return [];
  if (item.type === 'custom_tool_call') return [normalizedCustomCall(item, refs)];
  if (item.type === 'custom_tool_call_output') return [normalizedCustomOutput(item)];
  if (item.type === 'function_call') return [normalizedFunctionCall(item, refs)];

  return [item];
}

function normalizedCustomCall(
  item: Extract<ResponsesInputItem, { type: 'custom_tool_call' }>,
  refs: readonly NamespaceRef[],
): ResponsesInputItem {
  return {
    type: 'function_call',
    call_id: item.call_id,
    name: qualifiedCallName(item.name, undefined, refs),
    arguments: customArguments(item.input),
  };
}

function normalizedCustomOutput(
  item: Extract<ResponsesInputItem, { type: 'custom_tool_call_output' }>,
): ResponsesInputItem {
  return { type: 'function_call_output', call_id: item.call_id, output: item.output ?? '' };
}

function normalizedFunctionCall(
  item: Extract<ResponsesInputItem, { type: 'function_call' }>,
  refs: readonly NamespaceRef[],
): ResponsesInputItem {
  return { ...item, name: qualifiedCallName(item.name, item.namespace, refs) };
}

function qualifiedCallName(
  name: string,
  namespace: string | undefined,
  refs: readonly NamespaceRef[],
): string {
  if (namespace !== undefined) return qualifyResponsesToolName(namespace, name);

  const matches = refs.filter((ref) => ref.child === name);

  return matches.length === 1 ? (matches[0]?.qualified ?? name) : name;
}

function normalizedChoice(
  choice: ResponsesToolChoice | undefined,
  refs: readonly NamespaceRef[],
  directNames: ReadonlySet<string>,
): ResponsesToolChoice | undefined {
  if (choice === undefined) return undefined;
  if (typeof choice === 'string') return choice;

  return normalizedObjectChoice(choice, refs, directNames);
}

function normalizedObjectChoice(
  choice: Exclude<ResponsesToolChoice, string>,
  refs: readonly NamespaceRef[],
  directNames: ReadonlySet<string>,
): ResponsesToolChoice {
  if (choice.type === 'web_search') return choice;
  if (choice.type === 'custom') return { type: 'function', name: choice.name };
  const name = responsesToolChoiceName(choice);

  if (directNames.has(name)) return { type: 'function', name };

  return {
    type: 'function',
    name: qualifiedCallName(name, 'namespace' in choice ? choice.namespace : undefined, refs),
  };
}

export function isResponsesExtensionItem(
  item: ResponsesInputItem,
): item is Extract<
  ResponsesInputItem,
  { type: 'additional_tools' | 'custom_tool_call' | 'custom_tool_call_output' }
> {
  return (
    item.type === 'additional_tools' ||
    item.type === 'custom_tool_call' ||
    item.type === 'custom_tool_call_output'
  );
}

export function normalizeResponsesExtensions(request: ResponsesRequest): ResponsesRequest {
  const refs: NamespaceRef[] = [];
  const top = candidatesOf(request.tools ?? [], 3, 0, refs);
  const extra = candidatesOf(additionalTools(request.input), 2, top.length, refs);
  const tools = selectedTools([...top, ...extra]);
  const directNames = new Set(top.map(({ tool }) => toolKey(tool)));
  const choice = normalizedChoice(request.tool_choice, refs, directNames);

  return {
    ...request,
    input: request.input.flatMap((item) => normalizedInputItem(item, refs)),
    ...(tools.length === 0 ? {} : { tools }),
    ...(choice === undefined ? {} : { tool_choice: choice }),
  };
}

export function responsesToolRefs(
  request: ResponsesRequest,
): Readonly<Record<string, ResponsesToolRef>> {
  const namespaceRefs: NamespaceRef[] = [];
  const top = candidatesOf(request.tools ?? [], 3, 0, namespaceRefs);
  const extra = candidatesOf(additionalTools(request.input), 2, top.length, namespaceRefs);
  const entries = selectedCandidates([...top, ...extra]).flatMap((candidate) =>
    candidate.ref === undefined ? [] : [[toolKey(candidate.tool), candidate.ref] as const],
  );

  return Object.fromEntries(entries);
}

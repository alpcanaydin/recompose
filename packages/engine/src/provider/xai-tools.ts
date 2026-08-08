import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

type ToolNormalizer = (tool: JsonObject, namespace: string) => JsonObject[];

function keepsOriginalName(namespace: string, name: string): boolean {
  return namespace === '' || name === '' || name.startsWith('mcp__');
}

function qualifiedName(namespace: string, name: string): string {
  const trimmedNamespace = namespace.trim();
  const trimmedName = name.trim();

  if (keepsOriginalName(trimmedNamespace, trimmedName)) return trimmedName;

  const prefix = trimmedNamespace.endsWith('__') ? trimmedNamespace : `${trimmedNamespace}__`;

  return trimmedName.startsWith(prefix) ? trimmedName : `${prefix}${trimmedName}`;
}

function unionBranches(parameters: JsonObject, field: 'anyOf' | 'oneOf'): unknown[] | undefined {
  const value = parameters[field];

  return Array.isArray(value) ? value : undefined;
}

function objectBranch(branch: unknown): unknown {
  if (!isJsonObject(branch) || branch['type'] !== undefined) return branch;

  return { ...branch, type: 'object' };
}

function normalizedParameters(value: unknown): JsonObject {
  const parameters = isJsonObject(value) ? value : { type: 'object', properties: {} };
  const anyOf = unionBranches(parameters, 'anyOf');
  const oneOf = unionBranches(parameters, 'oneOf');

  return {
    ...parameters,
    ...(anyOf === undefined ? {} : { anyOf: anyOf.map(objectBranch) }),
    ...(oneOf === undefined ? {} : { oneOf: oneOf.map(objectBranch) }),
  };
}

function normalizedFunction(tool: JsonObject, namespace: string): JsonObject {
  const name = typeof tool['name'] === 'string' ? tool['name'] : '';

  return {
    ...tool,
    type: 'function',
    name: qualifiedName(namespace, name),
    parameters: normalizedParameters(tool['parameters']),
  };
}

function normalizedNamespace(tool: JsonObject): JsonObject[] {
  const name = typeof tool['name'] === 'string' ? tool['name'] : '';
  const tools: unknown[] = Array.isArray(tool['tools']) ? tool['tools'] : [];

  return tools.flatMap((nested) => normalizedTool(nested, name));
}

function namespaceGroup(tool: unknown): { namespace: string; children: unknown[] } | null {
  if (!isJsonObject(tool) || tool['type'] !== 'namespace') return null;

  const namespace = typeof tool['name'] === 'string' ? tool['name'].trim() : '';
  const children: unknown[] = Array.isArray(tool['tools']) ? tool['tools'] : [];

  return { namespace, children };
}

function namespaceRef(
  namespace: string,
  child: unknown,
): [string, { namespace: string; name: string }][] {
  if (!isJsonObject(child) || typeof child['name'] !== 'string') return [];

  const name = child['name'].trim();
  const qualified = qualifiedName(namespace, name);

  return qualified === '' ? [] : [[qualified, { namespace, name }]];
}

function namespaceRefs(tools: unknown[]): Record<string, { namespace: string; name: string }> {
  const entries = tools.flatMap((tool) => {
    const group = namespaceGroup(tool);

    return group === null
      ? []
      : group.children.flatMap((child) => namespaceRef(group.namespace, child));
  });

  return Object.fromEntries(entries);
}

export function collectXAINamespaceTools(
  body: JsonObject,
): Record<string, { namespace: string; name: string }> {
  const topLevel: unknown[] = Array.isArray(body['tools']) ? body['tools'] : [];
  const input: unknown[] = Array.isArray(body['input']) ? body['input'] : [];
  const additional = input.flatMap(additionalToolItems);

  return { ...namespaceRefs(topLevel), ...namespaceRefs(additional) };
}

function normalizedCustom(tool: JsonObject, namespace: string): JsonObject[] {
  return tool['name'] === 'apply_patch' ? [] : [normalizedFunction(tool, namespace)];
}

function normalizedWebSearch(tool: JsonObject): JsonObject[] {
  const { external_web_access: _external, ...rest } = tool;

  return [rest];
}

const TOOL_NORMALIZERS = new Map<string, ToolNormalizer>([
  ['tool_search', () => []],
  ['image_generation', () => []],
  ['function', (tool, namespace) => [normalizedFunction(tool, namespace)]],
  ['custom', normalizedCustom],
  ['web_search', normalizedWebSearch],
  ['namespace', normalizedNamespace],
]);

function normalizedTool(tool: unknown, namespace = ''): JsonObject[] {
  if (!isJsonObject(tool)) return [];

  const type = tool['type'];

  if (typeof type !== 'string') return [tool];

  const normalizer = TOOL_NORMALIZERS.get(type);

  return normalizer === undefined ? [tool] : normalizer(tool, namespace);
}

function additionalToolItems(item: unknown): unknown[] {
  return isJsonObject(item) && item['type'] === 'additional_tools' && Array.isArray(item['tools'])
    ? item['tools']
    : [];
}

function promotedBody(body: JsonObject): JsonObject {
  const input = body['input'];

  if (!Array.isArray(input)) return body;

  const inputItems: unknown[] = input;
  const promoted = inputItems.flatMap(additionalToolItems);

  if (promoted.length === 0) return body;

  const remaining = inputItems.filter(
    (item) => !(isJsonObject(item) && item['type'] === 'additional_tools'),
  );
  const topLevel: unknown[] = Array.isArray(body['tools']) ? body['tools'] : [];

  return { ...body, input: remaining, tools: [...topLevel, ...promoted] };
}

function functionChoice(value: unknown): JsonObject | null {
  return isJsonObject(value) && value['type'] === 'function' ? value : null;
}

function normalizedChoiceEntry(value: unknown): unknown {
  const choice = functionChoice(value);

  if (choice === null) return value;

  const namespace = typeof choice['namespace'] === 'string' ? choice['namespace'] : '';
  const name = typeof choice['name'] === 'string' ? choice['name'] : '';
  const { namespace: _namespace, ...rest } = choice;

  return namespace === '' ? choice : { ...rest, name: qualifiedName(namespace, name) };
}

function normalizedChoice(value: unknown): unknown {
  const choice = normalizedChoiceEntry(value);

  if (!isJsonObject(choice) || !Array.isArray(choice['tools'])) return choice;

  return { ...choice, tools: choice['tools'].map(normalizedChoiceEntry) };
}

function toolKey(value: unknown): string | undefined {
  if (!isJsonObject(value) || typeof value['type'] !== 'string') return undefined;

  return value['type'] === 'function' && typeof value['name'] === 'string'
    ? `function:${value['name']}`
    : `${value['type']}:`;
}

function availableTools(tools: unknown[]): Set<string> {
  return new Set(tools.map(toolKey).filter((key) => key !== undefined));
}

function prunedAllowedChoice(choice: JsonObject, available: Set<string>): JsonObject | undefined {
  const tools = choice['tools'];

  if (!Array.isArray(tools)) return undefined;

  const filtered = tools.filter((tool) => {
    const key = toolKey(tool);

    return key !== undefined && available.has(key);
  });

  return filtered.length === 0 ? undefined : { ...choice, tools: filtered };
}

function forcedChoice(choice: JsonObject, available: Set<string>): JsonObject | undefined {
  const key = toolKey(choice);

  return key !== undefined && available.has(key) ? choice : undefined;
}

function prunedChoice(choice: unknown, tools: unknown[]): unknown {
  if (typeof choice === 'string') return choice;
  if (!isJsonObject(choice)) return choice;

  const available = availableTools(tools);

  if (choice['type'] === 'allowed_tools') return prunedAllowedChoice(choice, available);

  return forcedChoice(choice, available);
}

export function normalizeXAITools(body: JsonObject): JsonObject {
  const promoted = promotedBody(body);
  const sourceTools: unknown[] = Array.isArray(promoted['tools']) ? promoted['tools'] : [];
  const tools = sourceTools.flatMap((tool) => normalizedTool(tool));
  const choice = normalizedChoice(promoted['tool_choice']);
  const pruned = prunedChoice(choice, tools);
  const { tools: _tools, tool_choice: _choice, ...rest } = promoted;

  return {
    ...rest,
    ...(tools.length === 0 ? {} : { tools }),
    ...(pruned === undefined ? {} : { tool_choice: pruned }),
  };
}

function withNativeSearch(body: JsonObject): JsonObject {
  const tools: unknown[] = Array.isArray(body['tools']) ? body['tools'] : [];
  const hasSearch = tools.some((tool) => isJsonObject(tool) && tool['type'] === 'x_search');

  return hasSearch ? body : { ...body, tools: [...tools, { type: 'x_search' }] };
}

function withAllowedSearch(body: JsonObject): JsonObject {
  const choice = body['tool_choice'];

  if (!isJsonObject(choice) || choice['type'] !== 'allowed_tools') return body;

  const allowed: unknown[] = Array.isArray(choice['tools']) ? choice['tools'] : [];
  const allowedHasSearch = allowed.some(
    (tool) => isJsonObject(tool) && tool['type'] === 'x_search',
  );

  return allowedHasSearch
    ? body
    : { ...body, tool_choice: { ...choice, tools: [...allowed, { type: 'x_search' }] } };
}

export function ensureXAINativeSearch(body: JsonObject): JsonObject {
  return withAllowedSearch(withNativeSearch(body));
}

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

function toolKey(type: string, namespace: string, name: string): string {
  return `${type === 'custom' ? 'function' : type}\0${namespace}\0${name}`;
}

function keysOf(tool: unknown, namespace: string): string[] {
  if (!isJsonObject(tool)) return [];
  if (tool['type'] === 'namespace') return namespaceKeys(tool);

  return directKeys(tool, namespace);
}

function directKeys(tool: JsonObject, namespace: string): string[] {
  const type = tool['type'];
  const name = tool['name'];

  return (type === 'function' || type === 'custom') && typeof name === 'string'
    ? [toolKey(type, namespace, name.trim())]
    : [];
}

function namespaceKeys(tool: JsonObject): string[] {
  const nested: unknown[] = Array.isArray(tool['tools']) ? tool['tools'] : [];
  const namespace = typeof tool['name'] === 'string' ? tool['name'].trim() : '';

  return nested.flatMap((child) => keysOf(child, namespace));
}

function additionalTools(input: unknown[]): unknown[] {
  const tools: unknown[] = [];

  for (const item of input) {
    if (!isJsonObject(item) || item['type'] !== 'additional_tools') continue;
    const nested: unknown[] = Array.isArray(item['tools']) ? item['tools'] : [];

    tools.push(...nested);
  }

  return tools;
}

export function collectXAIClientTools(body: JsonObject): string[] {
  const tools: unknown[] = Array.isArray(body['tools']) ? body['tools'] : [];
  const input: unknown[] = Array.isArray(body['input']) ? body['input'] : [];
  const keys = [...tools, ...additionalTools(input)].flatMap((tool) => keysOf(tool, ''));

  return [...new Set(keys)];
}

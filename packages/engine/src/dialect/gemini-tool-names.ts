import { createHash } from 'node:crypto';

import type {
  HubContentBlock,
  HubMessage,
  HubRequest,
  HubResponse,
  HubStreamEvent,
  HubToolChoice,
  HubToolResultBlock,
} from './hub';

function sanitizeFunctionName(name: string): string {
  let sanitized = name.replace(/[^a-zA-Z0-9_.:-]/gu, '_');

  if (sanitized === '') return '_';
  if (!/^[a-zA-Z_]/u.test(sanitized)) sanitized = `_${sanitized.slice(0, 63)}`;

  return sanitized.slice(0, 64);
}

function disambiguated(base: string, original: string, used: ReadonlySet<string>): string {
  for (let attempt = 0; ; attempt += 1) {
    const suffix = `_${createHash('sha256')
      .update(`${original}\0${String(attempt)}`)
      .digest('hex')
      .slice(0, 12)}`;
    const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;

    if (!used.has(candidate)) return candidate;
  }
}

export function geminiToolNameMap(names: readonly string[]): ReadonlyMap<string, string> {
  const unique = [...new Set(names.filter((name) => name !== ''))].toSorted();
  const counts = baseCounts(unique);

  return mappedNames(unique, counts);
}

function baseCounts(names: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const name of names) {
    const base = sanitizeFunctionName(name);

    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  return counts;
}

function mappedNames(
  names: readonly string[],
  counts: ReadonlyMap<string, number>,
): ReadonlyMap<string, string> {
  const used = new Set<string>();
  const mapped = new Map<string, string>();

  for (const name of names) {
    const base = sanitizeFunctionName(name);
    const selected =
      (counts.get(base) ?? 0) > 1 || used.has(base) ? disambiguated(base, name, used) : base;

    mapped.set(name, selected);
    used.add(selected);
  }

  return mapped;
}

function mappedName(names: ReadonlyMap<string, string>, name: string): string {
  return names.get(name) ?? sanitizeFunctionName(name);
}

function mappedToolResult(
  block: HubToolResultBlock,
  names: ReadonlyMap<string, string>,
  calls: ReadonlyMap<string, string>,
): HubToolResultBlock {
  const name =
    block.name === undefined ? calls.get(block.toolUseId) : mappedName(names, block.name);

  return { ...block, ...(name === undefined ? {} : { name }) };
}

function mappedBlock(
  block: HubContentBlock,
  names: ReadonlyMap<string, string>,
  calls: Map<string, string>,
): HubContentBlock {
  if (block.type === 'tool_use') {
    const name = mappedName(names, block.name);

    calls.set(block.id, name);

    return { ...block, name };
  }

  return block.type === 'tool_result' ? mappedToolResult(block, names, calls) : block;
}

function mappedMessages(
  messages: readonly HubMessage[],
  names: ReadonlyMap<string, string>,
): HubMessage[] {
  const calls = new Map<string, string>();

  return messages.map((message) => ({
    ...message,
    content: message.content.map((block) => mappedBlock(block, names, calls)),
  }));
}

function mappedToolChoice(
  choice: HubToolChoice | undefined,
  names: ReadonlyMap<string, string>,
): Pick<HubRequest, 'toolChoice'> | object {
  return choice?.type === 'tool'
    ? { toolChoice: { type: 'tool', name: mappedName(names, choice.name) } }
    : {};
}

export function mapGeminiToolNames(hub: HubRequest): HubRequest {
  const names = geminiToolNameMap(hub.tools?.map((tool) => tool.name) ?? []);

  return {
    ...hub,
    messages: mappedMessages(hub.messages, names),
    ...(hub.tools === undefined
      ? {}
      : { tools: hub.tools.map((tool) => ({ ...tool, name: mappedName(names, tool.name) })) }),
    ...mappedToolChoice(hub.toolChoice, names),
  };
}

export function reverseGeminiToolNames(hub: HubRequest): Readonly<Record<string, string>> {
  const forward = geminiToolNameMap(hub.tools?.map((tool) => tool.name) ?? []);

  return Object.fromEntries(
    [...forward].flatMap(([original, mapped]) => (original === mapped ? [] : [[mapped, original]])),
  );
}

function restoredName(names: Readonly<Record<string, string>>, name: string): string {
  return names[name] ?? name;
}

export function restoreGeminiResponseNames(
  response: HubResponse,
  names: Readonly<Record<string, string>>,
): HubResponse {
  return {
    ...response,
    content: response.content.map((block) =>
      block.type === 'tool_use' ? { ...block, name: restoredName(names, block.name) } : block,
    ),
  };
}

export function restoreGeminiStreamName(
  event: HubStreamEvent,
  names: Readonly<Record<string, string>>,
): HubStreamEvent {
  return event.type === 'block-open' && event.opening.kind === 'tool'
    ? {
        ...event,
        opening: { ...event.opening, name: restoredName(names, event.opening.name) },
      }
    : event;
}

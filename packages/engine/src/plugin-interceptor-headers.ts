import type { PluginHeaderMap } from './plugin-wire';

export function interceptorField(
  value: Record<string, unknown>,
  lower: string,
  upper: string,
): unknown {
  return value[lower] ?? value[upper];
}

export function interceptorStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function withoutHeaders(current: PluginHeaderMap, clear: readonly string[]): PluginHeaderMap {
  const removed = new Set(clear.map((name) => name.toLowerCase()));

  return Object.fromEntries(
    Object.entries(current).filter(([name]) => !removed.has(name.toLowerCase())),
  );
}

export function mergedPluginHeaders(
  current: PluginHeaderMap,
  next: PluginHeaderMap,
  clear: readonly string[],
): PluginHeaderMap {
  const merged = withoutHeaders(structuredClone(current), clear);

  for (const [name, values] of Object.entries(next)) merged[name] = [...values];

  return merged;
}

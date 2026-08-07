import { isJsonObject } from './gateway-wire';

export type PluginHeaderMap = Record<string, string[]>;

export function pluginBytes(value: unknown): Uint8Array {
  if (typeof value === 'string') return Buffer.from(value, 'base64');

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return Uint8Array.from(value);
  }

  return new Uint8Array();
}

function pluginHeaderValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function pluginHeaders(value: unknown): PluginHeaderMap {
  if (!isJsonObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([name, raw]) => [name, pluginHeaderValues(raw)]),
  );
}

export function webHeaders(values: PluginHeaderMap): Headers {
  const output = new Headers();

  for (const [name, items] of Object.entries(values)) {
    for (const item of items) output.append(name, item);
  }

  return output;
}

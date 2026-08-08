import type { JsonObject } from '../gateway-wire';

export function orderedCodexItems(indexed: ReadonlyMap<number, JsonObject>): JsonObject[] {
  return [...indexed.entries()].sort(([left], [right]) => left - right).map(([, item]) => item);
}

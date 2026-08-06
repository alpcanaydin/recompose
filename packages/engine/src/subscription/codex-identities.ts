import { createHash } from 'node:crypto';

type JsonObject = Record<string, unknown>;

function boundedId(value: string): string {
  const characters = Array.from(value);

  if (characters.length <= 64) {
    return value;
  }

  const suffix = `_${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;

  return characters.slice(0, 64 - suffix.length).join('') + suffix;
}

export function boundedCodexCallId(value: unknown): unknown {
  return typeof value === 'string' ? boundedId(value) : value;
}

export function normalizedCodexItemId(entry: JsonObject): string | undefined {
  const id = entry['id'];

  if (typeof id !== 'string') {
    return undefined;
  }

  const normalized = entry['type'] === 'message' && !id.startsWith('msg') ? `msg_${id}` : id;

  return boundedId(normalized);
}

export function dropsCodexEncryptedReasoning(entry: JsonObject): boolean {
  return (
    entry['type'] === 'reasoning' &&
    typeof entry['id'] === 'string' &&
    Array.from(entry['id']).length > 64 &&
    typeof entry['encrypted_content'] === 'string' &&
    entry['encrypted_content'] !== ''
  );
}

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

function normalizedAgentPart(part: unknown): unknown {
  if (!isJsonObject(part) || part['type'] !== 'encrypted_content') return part;

  return {
    type: 'input_text',
    text: typeof part['encrypted_content'] === 'string' ? part['encrypted_content'] : '',
  };
}

function normalizedAgentMessage(item: JsonObject): JsonObject {
  const content = item['content'];

  return {
    ...item,
    type: 'message',
    role: 'user',
    ...(Array.isArray(content) ? { content: content.map(normalizedAgentPart) } : {}),
  };
}

function parsedObject(text: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isJsonObject(parsed) ? JSON.stringify(parsed) : undefined;
  } catch {
    return undefined;
  }
}

function customArguments(input: unknown): string {
  if (input === undefined) return '{}';
  if (typeof input === 'string') return parsedObject(input) ?? JSON.stringify({ input });

  return isJsonObject(input) ? JSON.stringify(input) : JSON.stringify({ input });
}

function customOutput(output: unknown): string {
  if (output === undefined) return '';

  return typeof output === 'string' ? output : JSON.stringify(output);
}

function normalizedCustomCall(item: JsonObject): JsonObject | null {
  const callId = item['call_id'];
  const name = item['name'];

  if (typeof callId !== 'string' || callId.trim() === '') return null;
  if (typeof name !== 'string' || name.trim() === '') return null;

  return {
    type: 'function_call',
    call_id: callId.trim(),
    name: name.trim(),
    arguments: customArguments(item['input']),
  };
}

function normalizedCustomOutput(item: JsonObject): JsonObject | null {
  const callId = item['call_id'];

  return typeof callId !== 'string' || callId.trim() === ''
    ? null
    : {
        type: 'function_call_output',
        call_id: callId.trim(),
        output: customOutput(item['output']),
      };
}

function normalizedInputItem(item: unknown): unknown {
  if (!isJsonObject(item)) return item;
  if (item['type'] === 'agent_message') return normalizedAgentMessage(item);
  if (item['type'] === 'custom_tool_call') return normalizedCustomCall(item);

  return item['type'] === 'custom_tool_call_output' ? normalizedCustomOutput(item) : item;
}

export function validGrokEncryptedContent(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;

  try {
    return Buffer.from(value, 'base64').length === 256;
  } catch {
    return false;
  }
}

function sanitizedReasoning(item: JsonObject): JsonObject {
  const sanitized = { ...item };

  if (sanitized['content'] === null) delete sanitized['content'];

  if (
    sanitized['encrypted_content'] !== undefined &&
    !validGrokEncryptedContent(sanitized['encrypted_content'])
  ) {
    delete sanitized['encrypted_content'];
  }

  return sanitized;
}

function normalizedEncryptedItem(item: JsonObject): unknown {
  const encrypted = item['encrypted_content'];

  if (encrypted === undefined || validGrokEncryptedContent(encrypted)) {
    return item['type'] === 'reasoning' ? sanitizedReasoning(item) : item;
  }

  return item['type'] === 'compaction' ? null : sanitizedReasoning(item);
}

function sanitizedEncryptedItem(item: unknown): unknown {
  if (!isJsonObject(item)) return item;
  if (item['type'] !== 'reasoning' && item['type'] !== 'compaction') return item;

  return normalizedEncryptedItem(item);
}

function reasoningSummary(item: JsonObject): unknown[] {
  return Array.isArray(item['summary']) ? item['summary'] : [];
}

function reasoningWithoutEncrypted(value: unknown): value is JsonObject {
  return (
    isJsonObject(value) && value['type'] === 'reasoning' && value['encrypted_content'] === undefined
  );
}

function mergeableReasoning(left: unknown, right: unknown): boolean {
  return reasoningWithoutEncrypted(left) && reasoningWithoutEncrypted(right);
}

function mergedReasoning(items: unknown[]): unknown[] {
  const merged: unknown[] = [];

  for (const item of items) {
    const previous = merged.at(-1);

    if (mergeableReasoning(previous, item) && isJsonObject(previous) && isJsonObject(item)) {
      merged[merged.length - 1] = {
        ...previous,
        summary: [...reasoningSummary(previous), ...reasoningSummary(item)],
      };
    } else {
      merged.push(item);
    }
  }

  return merged;
}

export function normalizeXAIInput(body: JsonObject): JsonObject {
  const input = body['input'];

  if (!Array.isArray(input)) return body;

  const normalized = input.flatMap((item) => {
    const custom = normalizedInputItem(item);
    const sanitized = custom === null ? null : sanitizedEncryptedItem(custom);

    return sanitized === null ? [] : [sanitized];
  });

  return { ...body, input: mergedReasoning(normalized) };
}

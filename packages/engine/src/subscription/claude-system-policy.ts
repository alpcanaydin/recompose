import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

export type ClaudeSystemPolicy = {
  rebuildMidSystemMessages?: boolean;
  validateCallerSystem?: boolean;
  strictMode?: boolean;
};

export class ClaudeCallerSystemError extends Error {
  readonly status = 400;
  readonly scope = 'request';
}

export function applyClaudeSystemPolicy(
  body: JsonObject,
  policy: ClaudeSystemPolicy | undefined,
): JsonObject {
  if (policy === undefined) return body;

  const strictBody = policy.strictMode === true ? withoutCallerSystem(body) : body;

  if (policy.validateCallerSystem === true) validateClaudeCallerSystem(strictBody['system']);

  return policy.rebuildMidSystemMessages === true ? rebuiltMidSystem(strictBody) : strictBody;
}

export function validateClaudeCallerSystem(system: unknown): void {
  if (!Array.isArray(system)) return;

  for (const [index, block] of system.entries()) {
    const error = callerSystemError(block, index);

    if (error !== null) throw error;
  }
}

function callerSystemError(block: unknown, index: number): ClaudeCallerSystemError | null {
  if (isJsonObject(block) && block['type'] === 'text') return null;

  const type = isJsonObject(block) && typeof block['type'] === 'string' ? block['type'] : 'unknown';

  return new ClaudeCallerSystemError(
    `invalid_request_error: system.${String(index)}.type: Input should be 'text'. ` +
      `System instructions support text only, but this block has type ${JSON.stringify(type)}. ` +
      'Move non-text content into a user message.',
  );
}

function withoutCallerSystem(body: JsonObject): JsonObject {
  const { system: _system, ...rest } = body;

  return rest;
}

function rebuiltMidSystem(body: JsonObject): JsonObject {
  const messages = Array.isArray(body['messages']) ? body['messages'] : [];
  const moved = messages.flatMap(midSystemParts);

  if (moved.length === 0) return body;

  return {
    ...body,
    system: [...systemParts(body['system']), ...moved],
    messages: messages.filter((message) => !isSystemMessage(message)),
  };
}

function midSystemParts(message: unknown): JsonObject[] {
  return isSystemMessage(message) ? systemParts(message['content']) : [];
}

function isSystemMessage(message: unknown): message is JsonObject {
  return isJsonObject(message) && message['role'] === 'system';
}

function systemParts(value: unknown): JsonObject[] {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (!Array.isArray(value)) return [];

  return value.flatMap((block) =>
    isJsonObject(block) && block['type'] === 'text' ? [structuredClone(block)] : [],
  );
}

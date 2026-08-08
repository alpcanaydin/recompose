import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { antigravityClaudeSignature } from './claude-signatures';

function sanitizedThought(part: JsonObject): JsonObject | null {
  const text = part['text'];
  const signature = antigravityClaudeSignature(part['thoughtSignature']);

  if (text === '' || signature === null) return null;

  return { ...part, thoughtSignature: signature };
}

function sanitizedPart(value: unknown): unknown {
  if (!isJsonObject(value)) return value;

  const functionCall = value['functionCall'];

  if (isJsonObject(functionCall)) return withoutFunctionSignature(value, functionCall);
  if (value['thought'] !== true) return value;

  return sanitizedThought(value);
}

function withoutFunctionSignature(part: JsonObject, functionCall: JsonObject): JsonObject {
  const clean = { ...part };
  const call = { ...functionCall };

  delete clean['thoughtSignature'];
  delete clean['thought_signature'];
  delete call['thoughtSignature'];
  delete call['thought_signature'];
  clean['functionCall'] = call;

  return clean;
}

function sanitizedContent(value: unknown): unknown {
  if (!isJsonObject(value) || !Array.isArray(value['parts'])) return value;

  const parts = value['parts'].map(sanitizedPart).filter((part) => part !== null);

  return parts.length === 0 ? null : { ...value, parts };
}

export function sanitizeAntigravityClaudeSignatures(request: JsonObject, model: string): void {
  if (!model.toLowerCase().includes('claude')) return;

  const contents = request['contents'];

  if (!Array.isArray(contents)) return;

  request['contents'] = contents.map(sanitizedContent).filter((content) => content !== null);
}

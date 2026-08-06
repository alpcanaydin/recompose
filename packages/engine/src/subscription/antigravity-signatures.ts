import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import {
  geminiReplaySignature,
  isGeminiBypass,
  nativeGeminiSignature,
} from './antigravity-signature-envelope';

const SIGNATURE_KEYS = ['thoughtSignature', 'thought_signature'] as const;

function directSignature(value: JsonObject): string | undefined {
  for (const key of SIGNATURE_KEYS) {
    const signature = value[key];

    if (typeof signature === 'string') return signature;
  }

  return undefined;
}

function googleSignature(part: JsonObject): string | undefined {
  const extra = part['extra_content'];

  if (!isJsonObject(extra)) return undefined;

  const google = extra['google'];

  return isJsonObject(google) && typeof google['thought_signature'] === 'string'
    ? google['thought_signature']
    : undefined;
}

function signatureOf(part: JsonObject): string | undefined {
  const direct = directSignature(part);

  if (direct !== undefined) return direct;

  const call = part['functionCall'];
  const nested = isJsonObject(call) ? directSignature(call) : undefined;

  return nested ?? googleSignature(part);
}

function cleanNestedSignature(part: JsonObject, key: string): void {
  const value = part[key];

  if (!isJsonObject(value)) return;

  const clean = { ...value };

  delete clean['thoughtSignature'];
  delete clean['thought_signature'];
  part[key] = clean;
}

function withoutSignatures(part: JsonObject): JsonObject {
  const clean = { ...part };

  delete clean['thoughtSignature'];
  delete clean['thought_signature'];
  delete clean['extra_content'];
  cleanNestedSignature(clean, 'functionCall');
  cleanNestedSignature(clean, 'functionResponse');

  return clean;
}

function sanitizedSibling(part: JsonObject, signature: string): JsonObject {
  const native = nativeGeminiSignature(signature);
  const isCall = isJsonObject(part['functionCall']);

  if (native === null || (isCall && isGeminiBypass(native))) return withoutSignatures(part);

  return { ...withoutSignatures(part), thoughtSignature: native };
}

function sanitizedModelPart(part: JsonObject, firstCall: boolean): JsonObject {
  const signature = signatureOf(part);

  if (firstCall) {
    return { ...withoutSignatures(part), thoughtSignature: geminiReplaySignature(signature) };
  }

  if (signature === undefined) return part;

  return sanitizedSibling(part, signature);
}

function sanitizedPart(value: unknown, role: unknown, firstCallSeen: boolean): unknown {
  if (!isJsonObject(value)) return value;
  if (isJsonObject(value['functionResponse'])) return withoutSignatures(value);
  if (role !== 'model') return value;

  return sanitizedModelPart(value, isJsonObject(value['functionCall']) && !firstCallSeen);
}

function sanitizedParts(content: JsonObject): unknown[] | undefined {
  const rawParts = content['parts'];

  if (!Array.isArray(rawParts)) return undefined;

  const parts: unknown[] = rawParts;
  let firstCallSeen = false;

  return parts.map((value) => {
    const clean = sanitizedPart(value, content['role'], firstCallSeen);

    if (isJsonObject(value) && isJsonObject(value['functionCall'])) firstCallSeen = true;

    return clean;
  });
}

function sanitizedContent(value: unknown): unknown {
  if (!isJsonObject(value)) return value;

  const parts = sanitizedParts(value);

  return parts === undefined ? value : { ...value, parts };
}

export function sanitizeAntigravitySignatures(request: JsonObject, model: string): void {
  if (!/gemini|flash|agent/iu.test(model)) return;
  if (model.toLowerCase().includes('claude')) return;

  const rawContents = request['contents'];

  if (!Array.isArray(rawContents)) return;

  const contents: unknown[] = rawContents;

  request['contents'] = contents.map(sanitizedContent);
}

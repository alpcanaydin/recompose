import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import {
  geminiReplaySignature,
  geminiTextSignature,
  isGeminiBypass,
  nativeGeminiSignature,
} from './antigravity-signature-envelope';

const SIGNATURE_KEYS = ['thoughtSignature', 'thought_signature'] as const;

export type GeminiSignatureDecision = {
  action: 'replace_with_gemini_bypass';
  blockKind: 'gemini_function_call';
  component: 'signature_sanitizer';
  contentIndex: number;
  partIndex: number;
  signatureLength: number;
  targetProvider: 'gemini';
};

export type AntigravitySignaturePolicy = { strict?: boolean; cacheMode?: boolean };

type SignatureDecisionObserver = (decision: GeminiSignatureDecision) => void;

function skipsSignaturePrecheck(policy: AntigravitySignaturePolicy): boolean {
  return policy.cacheMode === true || policy.strict === false;
}

function sanitizesModel(model: string): boolean {
  return /gemini|flash|agent/iu.test(model) && !model.toLowerCase().includes('claude');
}

function bypassReplacement(replaySignature: string, sourceSignature: string | undefined): boolean {
  if (!isGeminiBypass(replaySignature)) return false;
  if (sourceSignature === undefined) return true;

  return !isGeminiBypass(sourceSignature);
}

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
  const isCall = isJsonObject(part['functionCall']);
  const native = isCall ? nativeGeminiSignature(signature) : geminiTextSignature(signature);

  if (native === null || (isCall && isGeminiBypass(native))) return withoutSignatures(part);

  return { ...withoutSignatures(part), thoughtSignature: native };
}

function observedBypass(
  replaySignature: string,
  sourceSignature: string | undefined,
  contentIndex: number,
  partIndex: number,
  observe: SignatureDecisionObserver | undefined,
): void {
  if (observe === undefined || !bypassReplacement(replaySignature, sourceSignature)) return;

  observe({
    action: 'replace_with_gemini_bypass',
    blockKind: 'gemini_function_call',
    component: 'signature_sanitizer',
    contentIndex,
    partIndex,
    signatureLength: sourceSignature === undefined ? 0 : sourceSignature.length,
    targetProvider: 'gemini',
  });
}

function sanitizedModelPart(
  part: JsonObject,
  firstCall: boolean,
  contentIndex: number,
  partIndex: number,
  observe: SignatureDecisionObserver | undefined,
): JsonObject {
  const signature = signatureOf(part);

  if (firstCall) {
    const replaySignature = geminiReplaySignature(signature);

    observedBypass(replaySignature, signature, contentIndex, partIndex, observe);

    return { ...withoutSignatures(part), thoughtSignature: replaySignature };
  }

  if (signature === undefined) return part;

  return sanitizedSibling(part, signature);
}

function sanitizedPart(
  value: unknown,
  role: unknown,
  firstCallSeen: boolean,
  contentIndex: number,
  partIndex: number,
  observe: SignatureDecisionObserver | undefined,
): unknown {
  if (!isJsonObject(value)) return value;
  if (isJsonObject(value['functionResponse'])) return withoutSignatures(value);
  if (role !== 'model') return value;

  return sanitizedModelPart(
    value,
    isJsonObject(value['functionCall']) && !firstCallSeen,
    contentIndex,
    partIndex,
    observe,
  );
}

function sanitizedParts(
  content: JsonObject,
  contentIndex: number,
  observe: SignatureDecisionObserver | undefined,
): unknown[] | undefined {
  const rawParts = content['parts'];

  if (!Array.isArray(rawParts)) return undefined;

  const parts: unknown[] = rawParts;
  let firstCallSeen = false;

  return parts.map((value, partIndex) => {
    const clean = sanitizedPart(
      value,
      content['role'],
      firstCallSeen,
      contentIndex,
      partIndex,
      observe,
    );

    if (isJsonObject(value) && isJsonObject(value['functionCall'])) firstCallSeen = true;

    return clean;
  });
}

function sanitizedContent(
  value: unknown,
  contentIndex: number,
  observe: SignatureDecisionObserver | undefined,
): unknown {
  if (!isJsonObject(value)) return value;

  const parts = sanitizedParts(value, contentIndex, observe);

  return parts === undefined ? value : { ...value, parts };
}

export function sanitizeAntigravitySignatures(
  request: JsonObject,
  model: string,
  observe?: SignatureDecisionObserver,
  policy: AntigravitySignaturePolicy = {},
): void {
  if (skipsSignaturePrecheck(policy)) return;
  if (!sanitizesModel(model)) return;

  const rawContents = request['contents'];

  if (!Array.isArray(rawContents)) return;

  const contents: unknown[] = rawContents;

  request['contents'] = contents.map((content, index) => sanitizedContent(content, index, observe));
}

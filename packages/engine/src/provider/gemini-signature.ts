import {
  GEMINI_CONTEXT_ENGINEERING_BYPASS,
  GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR,
  inspectGeminiThoughtSignature,
} from './gemini-signature-inspection';

const GEMINI_PREFIXES = new Set(['gemini', 'google']);

function unprefixed(signature: string): string | null {
  const value = signature.trim();
  const separator = value.indexOf('#');

  if (separator < 0) return value;

  const prefix = value.slice(0, separator).trim().toLowerCase();

  return GEMINI_PREFIXES.has(prefix) ? value.slice(separator + 1).trim() : null;
}

function bypass(value: string): boolean {
  return [GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR, GEMINI_CONTEXT_ENGINEERING_BYPASS].includes(
    value,
  );
}

export function nativeGeminiSignature(signature: unknown): string | null {
  if (typeof signature !== 'string') return null;

  const value = unprefixed(signature);

  if (value === null) return null;
  if (bypass(value)) return value;

  return inspectGeminiThoughtSignature(value, { requireKnownEnvelope: true }) === null
    ? null
    : value;
}

export function geminiTextSignature(signature: unknown): string | null {
  if (typeof signature !== 'string') return null;

  const value = unprefixed(signature);

  return value !== null && inspectGeminiThoughtSignature(value) !== null ? value : null;
}

export function geminiReplaySignature(signature: unknown): string {
  return nativeGeminiSignature(signature) ?? GEMINI_SKIP_THOUGHT_SIGNATURE_VALIDATOR;
}

export function isGeminiBypass(signature: string): boolean {
  const value = unprefixed(signature);

  return value !== null && bypass(value);
}

import { isCodexReasoningSignature } from '../dialect/responses-shared';
import {
  antigravityClaudeSignature,
  nativeClaudeSignature,
} from '../subscription/claude-signatures';
import { nativeGeminiSignature } from './gemini-signature';

export const MAX_GROK_ENCRYPTED_CONTENT_LENGTH = 8 * 1024 * 1024;
export const MIN_GROK_ENCRYPTED_CONTENT_DECODED_LENGTH = 32;
export const MIN_GROK_ENCRYPTED_CONTENT_ENTROPY_RATIO = 0.85;

const STANDARD_BASE64 = /^[A-Za-z0-9+/]+$/u;
const PROVIDER_PREFIX =
  /^(?:anthropic|cais|ccmax|claude(?:[-_]cais|[-_]code[-_]max)?|codex|gemini|google|gpt|openai)#/iu;

export type GrokEncryptedContentInfo = {
  rawLength: number;
  decodedLength: number;
};

function decodedGrokContent(value: string): Buffer | null {
  if (!STANDARD_BASE64.test(value)) return null;

  const decoded = Buffer.from(value, 'base64');
  const canonical = decoded.toString('base64').replace(/=+$/u, '');

  return canonical === value ? decoded : null;
}

function claudeEnvelope(value: string): boolean {
  const claude = nativeClaudeSignature(value);

  return antigravityClaudeSignature(value) !== null || claude?.startsWith('C') === true;
}

function foreignProviderEnvelope(value: string): boolean {
  return (
    PROVIDER_PREFIX.test(value) ||
    isCodexReasoningSignature(value) ||
    claudeEnvelope(value) ||
    nativeGeminiSignature(value) !== null
  );
}

export function byteEntropyRatio(bytes: Uint8Array): number {
  if (bytes.length <= 1) return 0;

  const counts = new Uint32Array(256);

  for (const byte of bytes) counts[byte] = (counts[byte] ?? 0) + 1;

  const entropy = counts.reduce((sum, count) => {
    if (count === 0) return sum;

    const probability = count / bytes.length;

    return sum - probability * Math.log2(probability);
  }, 0);
  const maxSymbols = Math.min(bytes.length, 256);

  return entropy / Math.log2(maxSymbols);
}

function rawGrokContent(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function transportSafe(value: string): boolean {
  if (value.trim() !== value) return false;
  if (value.length > MAX_GROK_ENCRYPTED_CONTENT_LENGTH) return false;
  if (value.includes('=')) return false;

  return !foreignProviderEnvelope(value);
}

function decodedSafe(decoded: Buffer | null): decoded is Buffer {
  if (decoded === null) return false;
  if (decoded.length < MIN_GROK_ENCRYPTED_CONTENT_DECODED_LENGTH) return false;

  return byteEntropyRatio(decoded) >= MIN_GROK_ENCRYPTED_CONTENT_ENTROPY_RATIO;
}

export function inspectGrokEncryptedContent(value: unknown): GrokEncryptedContentInfo | null {
  const raw = rawGrokContent(value);

  if (raw === null || !transportSafe(raw)) return null;

  const decoded = decodedGrokContent(raw);

  if (!decodedSafe(decoded)) return null;

  return { rawLength: raw.length, decodedLength: decoded.length };
}

export function validGrokEncryptedContent(value: unknown): boolean {
  return inspectGrokEncryptedContent(value) !== null;
}

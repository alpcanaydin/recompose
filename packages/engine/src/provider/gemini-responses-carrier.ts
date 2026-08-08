import { isGeminiBypass, nativeGeminiSignature } from './gemini-signature';

const PREFIX = 'cpa-gemini-responses-carrier-v1:';
const DIRECTIONS = new Set(['next', 'previous', 'standalone']);
const TARGETS = new Set(['text', 'function', 'any']);

export type GeminiCarrier = {
  signature: string;
  direction: 'next' | 'previous' | 'standalone';
  target: 'text' | 'function' | 'any';
};

export type GeminiCarrierDecode =
  | { marked: false; valid: true; signature: string }
  | { marked: true; valid: false }
  | ({ marked: true; valid: true } & GeminiCarrier);

export function encodeGeminiResponsesCarrier(carrier: GeminiCarrier): string {
  const signature = carrier.signature.trim();

  if (signature === '') return '';

  return `${PREFIX}${carrier.direction}:${carrier.target}:${Buffer.from(signature).toString('base64url')}`;
}

function canonicalCarrierBuffer(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;

  const buffer = Buffer.from(value, 'base64url');

  return buffer.toString('base64url') === value ? buffer : null;
}

function decodedSignature(value: string): string | null {
  const buffer = canonicalCarrierBuffer(value);

  if (buffer === null) return null;

  const decoded = buffer.toString('utf8');

  return decoded === '' || decoded.startsWith(PREFIX) ? null : decoded;
}

function validDirection(value: string): value is GeminiCarrier['direction'] {
  return DIRECTIONS.has(value);
}

function validTarget(value: string): value is GeminiCarrier['target'] {
  return TARGETS.has(value);
}

export function decodeGeminiResponsesCarrier(value: string): GeminiCarrierDecode {
  const trimmed = value.trim();

  if (!trimmed.startsWith(PREFIX)) return { marked: false, valid: true, signature: trimmed };

  return decodedMarkedCarrier(trimmed.slice(PREFIX.length));
}

function decodedMarkedCarrier(payload: string): GeminiCarrierDecode {
  const [direction = '', target = '', encoded = ''] = payload.split(':', 3);
  const signature = decodedSignature(encoded);
  const carrier = validatedCarrier(direction, target, signature);

  return carrier === null
    ? { marked: true, valid: false }
    : { marked: true, valid: true, ...carrier };
}

function validatedCarrier(
  direction: string,
  target: string,
  signature: string | null,
): GeminiCarrier | null {
  if (signature === null) return null;
  if (!validDirection(direction)) return null;
  if (!validTarget(target)) return null;

  return { direction, target, signature };
}

export function compatibleGeminiCarrierSignature(value: string): string | null {
  const decoded = decodeGeminiResponsesCarrier(value);

  if (!decoded.marked || !decoded.valid) return null;

  const native = nativeGeminiSignature(decoded.signature);

  return native === null || isGeminiBypass(native) ? null : native;
}

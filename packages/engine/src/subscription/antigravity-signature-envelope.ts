const BYPASS = 'skip_thought_signature_validator';
const CONTEXT_BYPASS = 'context_engineering_is_the_way_to_go';
const GEMINI_PREFIXES = new Set(['gemini', 'google']);

function unprefixed(signature: string): string | null {
  const value = signature.trim();
  const separator = value.indexOf('#');

  if (separator < 0) return value;

  const prefix = value.slice(0, separator).trim().toLowerCase();

  return GEMINI_PREFIXES.has(prefix) ? value.slice(separator + 1).trim() : null;
}

function decodedBase64(value: string): Buffer | null {
  if (value === '' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return null;

  const decoded = Buffer.from(value, 'base64');
  const canonical = decoded.toString('base64').replace(/=+$/u, '');

  return canonical === value.replace(/=+$/u, '') ? decoded : null;
}

function lengthDelimited(buffer: Buffer, offset: number): [Buffer, number] | null {
  const length = buffer[offset];

  if (length === undefined || length > 127) return null;

  const start = offset + 1;
  const end = start + length;

  return end <= buffer.length ? [buffer.subarray(start, end), end] : null;
}

function outerPayload(buffer: Buffer): Buffer | null {
  const outer = lengthDelimited(buffer, 1);

  if (outer === null || outer[1] !== buffer.length) return null;

  return outer[0];
}

function innerPayload(buffer: Buffer): Buffer | null {
  if (buffer[0] !== 0x12) return null;

  const outer = outerPayload(buffer);

  if (!hasInnerField(outer)) return null;

  const inner = lengthDelimited(outer, 1);

  return inner !== null && inner[1] === outer.length ? inner[0] : null;
}

function hasInnerField(outer: Buffer | null): outer is Buffer {
  return outer?.[0] === 0x0a;
}

function nativePayload(payload: Buffer): boolean {
  if (payload[0] === 0x01) return true;

  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(payload.toString());
}

function knownEnvelope(value: string): boolean {
  const decoded = decodedBase64(value);

  if (decoded === null) return false;

  const payload = innerPayload(decoded);

  return payload !== null && nativePayload(payload);
}

function bypass(value: string): boolean {
  return value === BYPASS || value === CONTEXT_BYPASS;
}

export function nativeGeminiSignature(signature: unknown): string | null {
  if (typeof signature !== 'string') return null;

  const value = unprefixed(signature);

  if (value === null) return null;

  return bypass(value) || knownEnvelope(value) ? value : null;
}

export function geminiReplaySignature(signature: unknown): string {
  return nativeGeminiSignature(signature) ?? BYPASS;
}

export function isGeminiBypass(signature: string): boolean {
  const value = unprefixed(signature);

  return value !== null && bypass(value);
}

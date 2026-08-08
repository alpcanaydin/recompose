const PREFIX = 'cpa-gemini-carrier-v1:';

export type GeminiClaudeCarrier = {
  signature: string;
  direction: 'next' | 'previous' | 'standalone';
  target: 'text' | 'function' | 'any';
};

export function encodeGeminiClaudeCarrier(carrier: GeminiClaudeCarrier): string {
  const signature = carrier.signature.trim();

  return signature === ''
    ? ''
    : `${PREFIX}${carrier.direction}:${carrier.target}:${Buffer.from(signature).toString('base64').replace(/=+$/u, '')}`;
}

export function decodeGeminiClaudeCarrier(value: unknown): GeminiClaudeCarrier | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (!trimmed.startsWith(PREFIX)) return null;

  const parts = carrierParts(trimmed);

  if (parts === null) return null;

  const signature = decodedSignature(parts.encoded);

  return signature === null
    ? null
    : { signature, direction: parts.direction, target: parts.target };
}

function carrierParts(
  trimmed: string,
): (Omit<GeminiClaudeCarrier, 'signature'> & { encoded: string }) | null {
  const [direction, target, encoded] = trimmed.slice(PREFIX.length).split(':', 3);

  if (!isDirection(direction)) return null;
  if (!isTarget(target)) return null;
  if (encoded === undefined) return null;

  return { direction, target, encoded };
}

function isDirection(value: string | undefined): value is GeminiClaudeCarrier['direction'] {
  return value === 'next' || value === 'previous' || value === 'standalone';
}

function isTarget(value: string | undefined): value is GeminiClaudeCarrier['target'] {
  return value === 'text' || value === 'function' || value === 'any';
}

function decodedSignature(encoded: string): string | null {
  if (!/^[A-Za-z0-9+/]+$/u.test(encoded)) return null;

  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const signature = Buffer.from(padded, 'base64').toString();

  return signature === '' || signature.startsWith(PREFIX) ? null : signature;
}

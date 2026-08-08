const STANDARD_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;

type Base64Options = { allowUnpadded?: boolean; maxLength?: number };

function withinMaximum(value: string, maximum: number | undefined): boolean {
  return value !== '' && value.length <= (maximum ?? Number.MAX_SAFE_INTEGER);
}

function validBase64(value: string, options: Base64Options): boolean {
  if (!withinMaximum(value, options.maxLength)) return false;
  if (!STANDARD_BASE64.test(value)) return false;

  return options.allowUnpadded === true || value.length % 4 === 0;
}

function comparableBase64(value: string, allowUnpadded: boolean): string {
  return allowUnpadded ? value.replace(/=+$/u, '') : value;
}

export function canonicalBase64(value: string, options: Base64Options = {}): Buffer | null {
  if (!validBase64(value, options)) return null;

  const decoded = Buffer.from(value, 'base64');
  const canonical = decoded.toString('base64');
  const allowUnpadded = options.allowUnpadded === true;

  return comparableBase64(canonical, allowUnpadded) === comparableBase64(value, allowUnpadded)
    ? decoded
    : null;
}

export function signatureVarint(
  bytes: Buffer,
  offset: number,
  maxBytes = 10,
): { end: number; value: number } | null {
  let value = 0;
  const end = Math.min(bytes.length, offset + maxBytes);

  for (let index = offset; index < end; index += 1) {
    const byte = bytes.at(index);

    if (byte === undefined) return null;

    value += (byte & 0x7f) * 2 ** (7 * (index - offset));
    if ((byte & 0x80) === 0) return { end: index + 1, value };
  }

  return null;
}

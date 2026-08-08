const rawIntegerPrefix = '__recompose_raw_integer__:';
const safeInteger = BigInt(Number.MAX_SAFE_INTEGER);
const numberPattern = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/u;

function afterString(text: string, start: number): number {
  let at = start + 1;

  while (at < text.length) {
    if (text[at] === '\\') at += 2;
    else if (text[at] === '"') return at + 1;
    else at += 1;
  }

  return at;
}

function numberAt(text: string, start: number): string | null {
  return numberPattern.exec(text.slice(start))?.[0] ?? null;
}

function unsafeInteger(token: string): boolean {
  if (!/^-?\d+$/u.test(token)) return false;

  const value = BigInt(token);

  return value > safeInteger || value < -safeInteger;
}

function preciseJsonText(text: string): string {
  let output = '';
  let at = 0;

  while (at < text.length) {
    if (text[at] === '"') {
      const end = afterString(text, at);

      output += text.slice(at, end);
      at = end;
      continue;
    }

    const token = numberAt(text, at);

    if (token !== null) {
      output += unsafeInteger(token) ? JSON.stringify(`${rawIntegerPrefix}${token}`) : token;
      at += token.length;
      continue;
    }

    output += text[at];
    at += 1;
  }

  return output;
}

function rawJsonValue(token: string): unknown {
  const rawJson: unknown = Reflect.get(JSON, 'rawJSON');

  return isUnaryFunction(rawJson) ? rawJson(token) : token;
}

function isUnaryFunction(value: unknown): value is (argument: unknown) => unknown {
  return typeof value === 'function';
}

function reviveRawInteger(value: unknown): unknown {
  return typeof value === 'string' && value.startsWith(rawIntegerPrefix)
    ? rawJsonValue(value.slice(rawIntegerPrefix.length))
    : value;
}

export function parsePreciseJson(text: string): unknown {
  return JSON.parse(preciseJsonText(text), (_key, value: unknown) => reviveRawInteger(value));
}

export function isRawJsonValue(value: unknown): boolean {
  const isRawJson: unknown = Reflect.get(JSON, 'isRawJSON');

  return isUnaryFunction(isRawJson) && isRawJson(value) === true;
}

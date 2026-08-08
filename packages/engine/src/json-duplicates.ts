type Scan = { at: number; duplicate?: string };

function whitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t';
}

function afterWhitespace(text: string, start: number): number {
  let at = start;

  while (whitespace(text[at])) {
    at += 1;
  }

  return at;
}

function afterString(text: string, start: number): number {
  let at = start + 1;

  while (at < text.length) {
    if (text[at] === '\\') {
      at += 2;
    } else if (text[at] === '"') {
      return at + 1;
    } else {
      at += 1;
    }
  }

  return at;
}

function decodedKey(text: string, start: number, end: number): string {
  const value: unknown = JSON.parse(text.slice(start, end));

  return typeof value === 'string' ? value : '';
}

function afterPrimitive(text: string, start: number): number {
  let at = start;

  while (at < text.length && ![',', '}', ']'].includes(text[at] ?? '')) {
    at += 1;
  }

  return at;
}

function scanArrayMembers(text: string, start: number, depth: number): Scan {
  const member = scanValue(text, start, depth);

  if (member.duplicate !== undefined) {
    return member;
  }

  const at = afterWhitespace(text, member.at);

  return text[at] === ',' ? scanArrayMembers(text, at + 1, depth) : { at: at + 1 };
}

function scanArray(text: string, start: number, depth: number): Scan {
  const at = afterWhitespace(text, start + 1);

  return text[at] === ']' ? { at: at + 1 } : scanArrayMembers(text, at, depth + 1);
}

function scanObjectMember(text: string, start: number, depth: number, keys: Set<string>): Scan {
  const keyStart = afterWhitespace(text, start);
  const keyEnd = afterString(text, keyStart);
  const key = decodedKey(text, keyStart, keyEnd);

  if (keys.has(key)) {
    return { at: keyEnd, duplicate: key };
  }

  keys.add(key);

  const colon = afterWhitespace(text, keyEnd);

  return scanValue(text, afterWhitespace(text, colon + 1), depth);
}

function scanObjectMembers(text: string, start: number, depth: number, keys: Set<string>): Scan {
  const member = scanObjectMember(text, start, depth, keys);

  if (member.duplicate !== undefined) {
    return member;
  }

  const at = afterWhitespace(text, member.at);

  return text[at] === ',' ? scanObjectMembers(text, at + 1, depth, keys) : { at: at + 1 };
}

function scanObject(text: string, start: number, depth: number): Scan {
  const at = afterWhitespace(text, start + 1);

  return text[at] === '}' ? { at: at + 1 } : scanObjectMembers(text, at, depth + 1, new Set());
}

function scanValue(text: string, start: number, depth: number): Scan {
  if (depth > 256) {
    return { at: text.length, duplicate: '<nesting-limit>' };
  }

  const at = afterWhitespace(text, start);
  const character = text[at];

  if (character === '{') {
    return scanObject(text, at, depth);
  }

  if (character === '[') {
    return scanArray(text, at, depth);
  }

  return { at: character === '"' ? afterString(text, at) : afterPrimitive(text, at) };
}

export function duplicateJsonKey(text: string): string | undefined {
  return scanValue(text, 0, 0).duplicate;
}

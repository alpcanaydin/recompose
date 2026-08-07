import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

export type LogCursor = {
  version: 1;
  file: string;
  offset: number;
  size: number;
  fingerprint: string;
  latestTimestamp: number;
};

export type CursorFile = { name: string; path: string; size: number };

function safeLogName(name: string): boolean {
  return (
    name === 'main.log' ||
    /^main\.log\.\d+$/u.test(name) ||
    /^main-\d{4}-\d{2}-\d{2}T[\d-]+\.log$/u.test(name)
  );
}

function cursorNumbers(record: Record<string, unknown>): boolean {
  return ['offset', 'size', 'latestTimestamp'].every((key) => typeof record[key] === 'number');
}

function cursorIdentity(record: Record<string, unknown>): boolean {
  return (
    record['version'] === 1 &&
    typeof record['file'] === 'string' &&
    typeof record['fingerprint'] === 'string'
  );
}

function cursorShape(value: unknown): value is LogCursor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const record = Object.fromEntries(Object.entries(value));

  return cursorIdentity(record) && cursorNumbers(record);
}

export function decodedLogCursor(value: string): LogCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

    if (!cursorShape(parsed)) return null;
    if (!safeLogName(parsed.file) || basename(parsed.file) !== parsed.file) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function encodedLogCursor(cursor: LogCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

async function fingerprint(file: CursorFile, size: number): Promise<string> {
  const data = await readFile(file.path);
  const sample = data.subarray(0, Math.min(size, data.byteLength, 4096));

  return createHash('sha256').update(sample).update(String(size)).digest('hex');
}

export async function cursorFor(
  file: CursorFile,
  offset: number,
  latestTimestamp: number,
): Promise<string> {
  return encodedLogCursor({
    version: 1,
    file: file.name,
    offset,
    size: file.size,
    fingerprint: await fingerprint(file, file.size),
    latestTimestamp,
  });
}

export async function cursorMatches(file: CursorFile, cursor: LogCursor): Promise<boolean> {
  return (await fingerprint(file, cursor.size)) === cursor.fingerprint;
}

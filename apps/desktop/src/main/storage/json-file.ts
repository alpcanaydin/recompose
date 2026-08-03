import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;

  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

export async function quarantineFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<void> {
  const quarantinedPath = `${filePath}.corrupt-${new Date().toISOString().replaceAll(':', '-')}`;

  await rename(filePath, quarantinedPath);
  onCorrupt(quarantinedPath);
}

export async function readJsonWithQuarantine(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<unknown> {
  let raw: string;

  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return parsed;
  } catch {
    await quarantineFile(filePath, onCorrupt);

    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function namedSchemaVersion(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const named = value['schemaVersion'];

  return typeof named === 'number' && Number.isInteger(named) ? named : undefined;
}

/**
 * The version a document names, when that version is beyond what this build supports.
 *
 * @summary Read it before parsing. A document from a newer build fails every schema this build
 * knows, and a reader that cannot tell that apart from damage moves a good file aside.
 */
export function newerSchemaVersion(value: unknown, supported: number): number | undefined {
  const named = namedSchemaVersion(value);

  return named !== undefined && named > supported ? named : undefined;
}

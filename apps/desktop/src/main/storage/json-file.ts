import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;

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

export async function readDocumentWithQuarantine<T>(
  filePath: string,
  parse: (raw: unknown) => T,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<T | undefined> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return undefined;
  }

  try {
    return parse(raw);
  } catch {
    await quarantineFile(filePath, onCorrupt);

    return undefined;
  }
}

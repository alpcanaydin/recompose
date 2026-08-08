import { readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type LogFile = { path: string; size: number; modified: number };

export async function enforceProviderLogDirectoryLimit(
  directory: string,
  maxBytes: number,
  protectedPaths: readonly string[] = [],
): Promise<number> {
  const protectedSet = new Set(protectedPaths.map((path) => resolve(path)));
  const files = await logFiles(directory);
  let total = files.reduce((sum, file) => sum + file.size, 0);
  const deleted: LogFile[] = [];

  for (const file of files.toSorted((left, right) => left.modified - right.modified)) {
    if (total <= maxBytes) break;
    if (protectedSet.has(resolve(file.path))) continue;

    total -= file.size;
    deleted.push(file);
  }

  await Promise.all(
    deleted.map(async (file) => {
      await rm(file.path, { force: true });
    }),
  );

  return deleted.length;
}

async function logFiles(directory: string): Promise<LogFile[]> {
  const names = await readdir(directory);
  const files = await Promise.all(
    names.map(async (name) => {
      const file = await logFile(directory, name);

      return file;
    }),
  );

  return files.flatMap((file) => (file === null ? [] : [file]));
}

async function logFile(directory: string, name: string): Promise<LogFile | null> {
  const path = join(directory, name);
  const info = await stat(path);

  return info.isFile() ? { path, size: info.size, modified: info.mtimeMs } : null;
}

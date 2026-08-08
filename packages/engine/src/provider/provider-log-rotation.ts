import { rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

function missingFile(failure: unknown): boolean {
  return (
    typeof failure === 'object' && failure !== null && Reflect.get(failure, 'code') === 'ENOENT'
  );
}

async function removeIfPresent(path: string): Promise<void> {
  await rm(path, { force: true });
}

async function renameIfPresent(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (failure) {
    if (!missingFile(failure)) throw failure;
  }
}

async function currentSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch (failure) {
    if (missingFile(failure)) return 0;

    throw failure;
  }
}

export async function rotateProviderLog(
  directory: string,
  incomingBytes: number,
  maxBytes: number,
  maxFiles: number,
): Promise<void> {
  const active = join(directory, 'main.log');

  if ((await currentSize(active)) + incomingBytes <= maxBytes) return;

  await removeIfPresent(join(directory, `main.log.${String(maxFiles)}`));

  await shiftRotations(directory, maxFiles - 1);

  await renameIfPresent(active, join(directory, 'main.log.1'));
}

async function shiftRotations(directory: string, index: number): Promise<void> {
  if (index < 1) return;

  await renameIfPresent(
    join(directory, `main.log.${String(index)}`),
    join(directory, `main.log.${String(index + 1)}`),
  );
  await shiftRotations(directory, index - 1);
}

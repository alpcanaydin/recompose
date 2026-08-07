import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { rotateProviderLog } from './provider-log-rotation';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe('rotateProviderLog', () => {
  it('should shift rotated logs and remove files beyond retention', async () => {
    const directory = await temporaryDirectory();

    await Promise.all([
      writeFile(join(directory, 'main.log'), 'active', 'utf8'),
      writeFile(join(directory, 'main.log.1'), 'first', 'utf8'),
      writeFile(join(directory, 'main.log.2'), 'oldest', 'utf8'),
    ]);

    await rotateProviderLog(directory, 10, 10, 2);

    expect(await readdir(directory)).toEqual(['main.log.1', 'main.log.2']);
    await expect(readFile(join(directory, 'main.log.1'), 'utf8')).resolves.toBe('active');
    await expect(readFile(join(directory, 'main.log.2'), 'utf8')).resolves.toBe('first');
  });

  it('should keep the active log when the incoming record fits', async () => {
    const directory = await temporaryDirectory();
    const active = join(directory, 'main.log');

    await writeFile(active, 'small', 'utf8');
    await rotateProviderLog(directory, 2, 10, 2);

    await expect(readFile(active, 'utf8')).resolves.toBe('small');
    expect(await readdir(directory)).toEqual(['main.log']);
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-log-rotation-'));

  temporaryDirectories.push(directory);

  return directory;
}

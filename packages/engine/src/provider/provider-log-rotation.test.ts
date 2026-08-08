import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

  it('should treat a log directory that holds nothing yet as empty', async () => {
    const directory = await temporaryDirectory();

    await rotateProviderLog(directory, 10, 5, 2);

    expect(await readdir(directory)).toEqual([]);
  });
});

describe('rotateProviderLog against a filesystem that refuses', () => {
  it('should surface a size check the filesystem refuses to answer', async () => {
    const directory = await temporaryDirectory();
    const notADirectory = join(directory, 'main.log');

    await writeFile(notADirectory, 'active', 'utf8');

    await expect(rotateProviderLog(notADirectory, 10, 5, 2)).rejects.toThrow();
  });

  it('should surface a rotation the filesystem refuses to perform', async () => {
    const directory = await temporaryDirectory();
    const occupied = join(directory, 'main.log.1');

    await writeFile(join(directory, 'main.log'), 'active', 'utf8');
    await mkdir(occupied);
    await writeFile(join(occupied, 'held'), 'held', 'utf8');

    await expect(rotateProviderLog(directory, 10, 5, 0)).rejects.toThrow();
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-log-rotation-'));

  temporaryDirectories.push(directory);

  return directory;
}

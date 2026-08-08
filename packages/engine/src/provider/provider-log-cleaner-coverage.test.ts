import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { enforceProviderLogDirectoryLimit } from './provider-log-cleaner';

async function aLogDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-provider-logs-'));

  await mkdir(join(directory, 'archive'));
  await writeFile(join(directory, 'first.log'), 'a'.repeat(64));
  await writeFile(join(directory, 'second.log'), 'b'.repeat(64));

  return directory;
}

describe('trimming a provider log directory that holds a nested folder', () => {
  it('counts only the files it can delete', async () => {
    const directory = await aLogDirectory();

    await expect(enforceProviderLogDirectoryLimit(directory, 64)).resolves.toBe(1);
  });

  it('leaves the nested folder in place', async () => {
    const directory = await aLogDirectory();

    await enforceProviderLogDirectoryLimit(directory, 0);

    await expect(readdir(directory)).resolves.toEqual(['archive']);
  });
});

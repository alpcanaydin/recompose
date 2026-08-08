import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ProviderLogStore } from './provider-log-store';

const temporaryDirectories: string[] = [];
const maxLineBytes = 8 * 1024 * 1024;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe('reading provider logs that hold nothing', () => {
  it('should answer an empty read for a directory with no log yet', async () => {
    const store = new ProviderLogStore(await temporaryDirectory());

    const read = await store.read({ after: 42 });

    expect(read).toEqual({
      lines: [],
      lineCount: 0,
      latestTimestamp: 42,
      nextCursor: '',
      cursorReset: false,
    });
  });

  it('should report a cursor reset when the caller resumes an empty directory', async () => {
    const store = new ProviderLogStore(await temporaryDirectory());

    const read = await store.read({ cursor: 'anything' });

    expect(read.cursorReset).toBe(true);
  });

  it('should refuse a cursor it cannot read', async () => {
    const directory = await temporaryDirectory();

    await writeFile(join(directory, 'main.log'), 'first\n', 'utf8');

    await expect(new ProviderLogStore(directory).read({ cursor: 'not-a-cursor' })).rejects.toThrow(
      'invalid log cursor',
    );
  });
});

describe('reading provider logs across rotation names', () => {
  it('should read a rotation named after the day it closed', async () => {
    const directory = await temporaryDirectory();

    await writeFile(join(directory, 'main-2026-06-15T10-00-00.log'), 'archived\n', 'utf8');
    await writeFile(join(directory, 'main.log'), 'active\n', 'utf8');
    await writeFile(join(directory, 'unrelated.log'), 'ignored\n', 'utf8');

    const read = await new ProviderLogStore(directory).read();

    expect(read.lines).toEqual(['archived', 'active']);
  });

  it('should order rotations by name when the clock cannot separate them', async () => {
    const directory = await temporaryDirectory();
    const stamp = new Date('2026-06-15T10:00:00Z');

    await writeFile(join(directory, 'main.log.2'), 'oldest\n', 'utf8');
    await writeFile(join(directory, 'main.log.1'), 'older\n', 'utf8');
    await utimes(join(directory, 'main.log.1'), stamp, stamp);
    await utimes(join(directory, 'main.log.2'), stamp, stamp);

    const read = await new ProviderLogStore(directory).read();

    expect(read.lines).toEqual(['older', 'oldest']);
  });
});

describe('reading provider log lines the writer shaped', () => {
  it('should read a line the writer ended the Windows way', async () => {
    const directory = await temporaryDirectory();

    await writeFile(join(directory, 'main.log'), 'first\r\nsecond\r\n', 'utf8');

    const read = await new ProviderLogStore(directory).read();

    expect(read.lines).toEqual(['first', 'second']);
  });

  it('should refuse a line longer than the reader will hold', async () => {
    const directory = await temporaryDirectory();

    await writeFile(join(directory, 'main.log'), `${'x'.repeat(maxLineBytes + 1)}\n`, 'utf8');

    await expect(new ProviderLogStore(directory).read()).rejects.toThrow(
      'log line exceeds 8388608 bytes',
    );
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-log-store-'));

  temporaryDirectories.push(directory);

  return directory;
}

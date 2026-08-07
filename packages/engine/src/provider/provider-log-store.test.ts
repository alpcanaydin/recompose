import { appendFile, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { decodedLogCursor } from './provider-log-cursor';
import { ProviderLogStore } from './provider-log-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe('decodedLogCursor', () => {
  it('should reject unsafe log file names', () => {
    for (const file of ['', '.', '..', '../secret', 'nested/main.log', 'error.log']) {
      expect(decodedLogCursor(cursorFor(file))).toBeNull();
    }
  });

  it('should accept only known main log rotation names', () => {
    for (const file of ['main.log', 'main.log.1', 'main-2026-06-15T10-00-00.log']) {
      expect(decodedLogCursor(cursorFor(file))).toMatchObject({ file });
    }
  });
});

describe('ProviderLogStore tail reads', () => {
  it('should return recent lines with a cursor', async () => {
    const fixture = await logFixture([
      '[2026-06-15 10:00:00] first',
      '[2026-06-15 10:00:01] second',
      '[2026-06-15 10:00:02] third',
      '[2026-06-15 10:00:03] fourth',
    ]);

    const read = await fixture.store.read({ limit: 2 });

    expect(read.lines).toEqual(['[2026-06-15 10:00:02] third', '[2026-06-15 10:00:03] fourth']);
    expect(read.lineCount).toBe(2);
    expect(read.nextCursor).not.toBe('');
    expect(read.latestTimestamp).toBe(epoch('2026-06-15T10:00:03'));
  });

  it('should exclude a trailing partial line until it completes', async () => {
    const fixture = await logFixture(['first'], 'partial');

    const initial = await fixture.store.read();

    await appendFile(fixture.path, '\n', 'utf8');
    const next = await fixture.store.read({ cursor: initial.nextCursor });

    expect(initial.lines).toEqual(['first']);
    expect(next.lines).toEqual(['partial']);
  });

  it('should filter timestamped lines after a cutoff', async () => {
    const fixture = await logFixture([
      '[2026-06-15 10:00:00] first',
      '[2026-06-15 10:00:01] second',
      '[2026-06-15 10:00:02] third',
    ]);

    const read = await fixture.store.read({ after: epoch('2026-06-15T10:00:00') });

    expect(read.lines).toEqual(['[2026-06-15 10:00:01] second', '[2026-06-15 10:00:02] third']);
    expect(read.lineCount).toBe(3);
  });
});

describe('ProviderLogStore cursor reads', () => {
  it('should return only lines appended after the cursor', async () => {
    const fixture = await logFixture(['first']);
    const initial = await fixture.store.read({ limit: 1 });

    await appendFile(fixture.path, 'second\n', 'utf8');
    const next = await fixture.store.read({ cursor: initial.nextCursor, limit: 10 });

    expect(next.lines).toEqual(['second']);
    expect(next.cursorReset).toBe(false);
  });

  it('should reset to the tail after the active log is truncated', async () => {
    const fixture = await logFixture(['first', 'second', 'third']);
    const initial = await fixture.store.read({ limit: 3 });

    await writeFile(fixture.path, 'reset\n', 'utf8');
    const next = await fixture.store.read({ cursor: initial.nextCursor, limit: 1 });

    expect(next.lines).toEqual(['reset']);
    expect(next.cursorReset).toBe(true);
  });

  it('should continue across rotation before reading the new main log', async () => {
    const fixture = await logFixture(['first']);
    const initial = await fixture.store.read({ limit: 1 });

    await appendFile(fixture.path, 'second\n', 'utf8');
    await rename(fixture.path, `${fixture.path}.1`);
    await writeFile(fixture.path, 'third\n', 'utf8');
    const next = await fixture.store.read({ cursor: initial.nextCursor, limit: 10 });

    expect(next.lines).toEqual(['second', 'third']);
    expect(next.cursorReset).toBe(false);
  });

  it('should continue from the new main after a limited rotated read', async () => {
    const fixture = await logFixture(['first line with enough bytes']);
    const initial = await fixture.store.read({ limit: 1 });

    await appendFile(fixture.path, 'second\n', 'utf8');
    await rename(fixture.path, `${fixture.path}.1`);
    await writeFile(fixture.path, 'new\n', 'utf8');
    const rotated = await fixture.store.read({ cursor: initial.nextCursor, limit: 1 });
    const current = await fixture.store.read({ cursor: rotated.nextCursor, limit: 1 });

    expect(rotated.lines).toEqual(['second']);
    expect(rotated.cursorReset).toBe(false);
    expect(current.lines).toEqual(['new']);
    expect(current.cursorReset).toBe(false);
  });

  it('should keep a cursor stable while only a partial line exists', async () => {
    const fixture = await logFixture(['first']);
    const initial = await fixture.store.read({ limit: 1 });

    await appendFile(fixture.path, 'partial', 'utf8');
    const partial = await fixture.store.read({ cursor: initial.nextCursor, limit: 10 });

    expect(partial.lines).toEqual([]);
    expect(partial.nextCursor).toBe(initial.nextCursor);
  });
});

// Helpers

function cursorFor(file: string): string {
  return Buffer.from(
    JSON.stringify({
      version: 1,
      file,
      offset: 0,
      size: 0,
      fingerprint: 'fingerprint',
      latestTimestamp: 0,
    }),
  ).toString('base64url');
}

async function logFixture(lines: readonly string[], trailing = '') {
  const directory = await mkdtemp(join(tmpdir(), 'recompose-provider-logs-'));
  const path = join(directory, 'main.log');

  temporaryDirectories.push(directory);
  await writeFile(path, `${lines.join('\n')}\n${trailing}`, 'utf8');

  return { directory, path, store: new ProviderLogStore(directory) };
}

function epoch(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

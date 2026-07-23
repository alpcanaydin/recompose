import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-storage-'));
}

describe('json file shell', () => {
  test('a written document reads back identically', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');

    await writeJsonAtomic(file, { a: 1, nested: { b: 'two' } });

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ a: 1, nested: { b: 'two' } });
  });

  test('writing leaves no temporary files behind', async () => {
    const dir = await freshDir();

    await writeJsonAtomic(join(dir, 'doc.json'), { a: 1 });

    expect(await readdir(dir)).toEqual(['doc.json']);
  });

  test('an absent file reads as undefined without invoking quarantine', async () => {
    const dir = await freshDir();
    const seen: string[] = [];

    const result = await readJsonWithQuarantine(join(dir, 'missing.json'), (p) => seen.push(p));

    expect(result).toBeUndefined();
    expect(seen).toEqual([]);
  });

  test('a corrupt file is quarantined aside and reported, not deleted', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');

    await writeFile(file, '{ not json', 'utf8');
    const seen: string[] = [];

    const result = await readJsonWithQuarantine(file, (p) => seen.push(p));

    expect(result).toBeUndefined();
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^doc\.json\.corrupt-/);
    expect(await readFile(join(dir, entries[0] ?? ''), 'utf8')).toBe('{ not json');
  });
});

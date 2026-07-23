import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { readDocumentWithQuarantine, readJsonWithQuarantine, writeJsonAtomic } from './json-file';

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-storage-'));
}

function parseEvenNumber(raw: unknown): number {
  if (typeof raw !== 'number' || raw % 2 !== 0) {
    throw new Error('not an even number');
  }

  return raw;
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

describe('reading a document with schema validation: success paths', () => {
  test('an absent file yields undefined without calling parse or quarantine', async () => {
    const dir = await freshDir();
    const seen: string[] = [];

    const result = await readDocumentWithQuarantine(
      join(dir, 'missing.json'),
      parseEvenNumber,
      (p) => seen.push(p),
    );

    expect(result).toBeUndefined();
    expect(seen).toEqual([]);
  });

  test('a value that parses cleanly is returned', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');

    await writeJsonAtomic(file, 4);

    const result = await readDocumentWithQuarantine(file, parseEvenNumber, () => undefined);

    expect(result).toBe(4);
  });
});

describe('reading a document with schema validation: quarantine paths', () => {
  test('a value that fails schema validation is quarantined and reported', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');

    await writeJsonAtomic(file, 3);
    const seen: string[] = [];

    const result = await readDocumentWithQuarantine(file, parseEvenNumber, (p) => seen.push(p));

    expect(result).toBeUndefined();
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^doc\.json\.corrupt-/);
  });

  test('a syntactically corrupt file is quarantined without ever calling parse', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');

    await writeFile(file, '{ not json', 'utf8');
    const seen: string[] = [];

    const result = await readDocumentWithQuarantine(
      file,
      (): number => {
        throw new Error('parse should not run for syntactically invalid JSON');
      },
      (p) => seen.push(p),
    );

    expect(result).toBeUndefined();
    expect(seen).toHaveLength(1);
  });
});

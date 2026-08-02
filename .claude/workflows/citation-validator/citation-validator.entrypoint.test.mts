import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { CodeMapEntry } from './citation-validator.mts';

const VALIDATOR_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const VALIDATOR_SCRIPT_NAME = 'citation-validator.mts';

const PASSING_STATUS = 0;

const FAILING_VERDICT_STATUS = 1;

const scratchWorkspaces: string[] = [];

after(() => {
  for (const workspace of scratchWorkspaces) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

function scratchRepository(): string {
  const workspace = mkdtempSync(join(tmpdir(), 'citation-validator-'));

  scratchWorkspaces.push(workspace);

  return workspace;
}

function repositoryWithFile(fileName: string, contents: string): string {
  const repository = scratchRepository();

  writeFileSync(join(repository, fileName), contents);

  return repository;
}

function entry(overrides: Partial<CodeMapEntry>): CodeMapEntry {
  return {
    path: 'src/widget.ts',
    symbols: [],
    layer: 'features',
    note: 'a fixture entry',
    ...overrides,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readPrintedVerdict(raw: string): { status: string; failures: readonly unknown[] } {
  const parsed: unknown = JSON.parse(raw);

  if (
    !isRecord(parsed) ||
    typeof parsed['status'] !== 'string' ||
    !Array.isArray(parsed['failures'])
  ) {
    throw new Error('the entry point did not print a verdict shape');
  }

  return { status: parsed['status'], failures: parsed['failures'] };
}

function readFailureReason(value: unknown): string {
  if (!isRecord(value) || typeof value['reason'] !== 'string') {
    throw new Error('a printed failure did not carry a reason');
  }

  return value['reason'];
}

function runEntryPoint(repositoryRoot: string, rawInput: string, cwd?: string) {
  const scriptPath = join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME);

  return spawnSync(process.execPath, [scriptPath, repositoryRoot], {
    ...(cwd === undefined ? {} : { cwd }),
    input: rawInput,
    encoding: 'utf8',
  });
}

function escapeFixture(): { insideRoot: string; secretPath: string } {
  const parent = scratchRepository();
  const insideRoot = join(parent, 'cv-inside');
  const outsideDir = join(parent, 'cv-outside');

  mkdirSync(insideRoot, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });
  writeFileSync(join(outsideDir, 'secret.ts'), 'export const secretThing = 1;');

  return { insideRoot, secretPath: join(outsideDir, 'secret.ts') };
}

describe('citation validator entry point: resolving paths against an explicit repository root', () => {
  it('resolves cited paths against the repository-root argument while the process runs elsewhere', () => {
    const repository = repositoryWithFile('real.ts', 'export function realThing() {}');
    const elsewhere = scratchRepository();
    const entries: readonly CodeMapEntry[] = [entry({ path: 'real.ts', symbols: ['realThing'] })];
    const run = runEntryPoint(repository, JSON.stringify(entries), elsewhere);

    assert.equal(run.status, PASSING_STATUS);
    assert.equal(readPrintedVerdict(run.stdout).status, 'pass');
  });
});

describe('citation validator entry point: a citation naming a directory', () => {
  it('passes when the entry cites no symbol, because a directory is a real place', () => {
    const repository = scratchRepository();

    mkdirSync(join(repository, 'src/widget-slice'), { recursive: true });

    const entries: readonly CodeMapEntry[] = [entry({ path: 'src/widget-slice', symbols: [] })];
    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, PASSING_STATUS);
    assert.equal(readPrintedVerdict(run.stdout).status, 'pass');
  });

  it('fails a symbol cited against it, naming the directory rather than a read failure', () => {
    const repository = scratchRepository();

    mkdirSync(join(repository, 'src/widget-slice'), { recursive: true });

    const entries: readonly CodeMapEntry[] = [
      entry({ path: 'src/widget-slice', symbols: ['createWidget'] }),
    ];
    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, FAILING_VERDICT_STATUS);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'fail');

    const reason = readFailureReason(verdict.failures[0]);

    assert.doesNotMatch(reason, /not found/);
    assert.match(reason, /directory/);
    assert.match(reason, /createWidget/);
  });
});

describe('citation validator entry point: an absolute citation inside the repository root', () => {
  it('passes, because rule 1 accepts a relative or an absolute path that lands inside the root', () => {
    const repository = repositoryWithFile('real.ts', 'export function realThing() {}');
    const absolutePath = join(repository, 'real.ts');
    const entries: readonly CodeMapEntry[] = [
      entry({ path: absolutePath, symbols: ['realThing'] }),
    ];
    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, PASSING_STATUS);
    assert.equal(readPrintedVerdict(run.stdout).status, 'pass');
  });
});

describe('citation validator entry point: a citation that escapes the repository root', () => {
  it('fails with a reason naming the escape for a .. traversal', () => {
    const { insideRoot } = escapeFixture();
    const entries: readonly CodeMapEntry[] = [
      entry({ path: '../cv-outside/secret.ts', symbols: ['secretThing'] }),
    ];
    const run = runEntryPoint(insideRoot, JSON.stringify(entries));

    assert.equal(run.status, FAILING_VERDICT_STATUS);

    const reason = readFailureReason(readPrintedVerdict(run.stdout).failures[0]);

    assert.match(reason, /escapes/);
    assert.doesNotMatch(reason, /not found/);
  });

  it('fails with a reason naming the escape for an absolute citation outside the root', () => {
    const { insideRoot, secretPath } = escapeFixture();
    const entries: readonly CodeMapEntry[] = [
      entry({ path: secretPath, symbols: ['secretThing'] }),
    ];
    const run = runEntryPoint(insideRoot, JSON.stringify(entries));

    assert.equal(run.status, FAILING_VERDICT_STATUS);

    const reason = readFailureReason(readPrintedVerdict(run.stdout).failures[0]);

    assert.match(reason, /escapes/);
    assert.doesNotMatch(reason, /not found/);
  });
});

describe('citation validator entry point: a code map run against a scratch repository', () => {
  it('exits non-zero and prints a failing verdict as JSON when a citation is bad', () => {
    const repository = repositoryWithFile('real.ts', 'export function realThing() {}');
    const entries: readonly CodeMapEntry[] = [
      entry({ path: 'real.ts', symbols: ['realThing'] }),
      entry({ path: 'ghost.ts', symbols: [] }),
    ];

    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, FAILING_VERDICT_STATUS);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);
  });

  it('exits zero and prints a passing verdict as JSON when every citation resolves', () => {
    const repository = repositoryWithFile('real.ts', 'export function realThing() {}');
    const entries: readonly CodeMapEntry[] = [entry({ path: 'real.ts', symbols: ['realThing'] })];

    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, PASSING_STATUS);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });

  it('accepts an empty symbols array as a legal citation with no symbols to check', () => {
    const repository = repositoryWithFile('store.ts', 'export const store = {};');
    const entries = [{ path: 'store.ts', symbols: [], layer: 'e', note: 'n' }];
    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, PASSING_STATUS);
    assert.equal(readPrintedVerdict(run.stdout).status, 'pass');
  });
});

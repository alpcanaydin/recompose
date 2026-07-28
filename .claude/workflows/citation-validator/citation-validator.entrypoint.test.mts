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

const INPUT_ERROR_STATUS = 2;

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

function readInputError(raw: string): { status: string; reason: string } {
  const parsed: unknown = JSON.parse(raw);

  if (
    !isRecord(parsed) ||
    typeof parsed['status'] !== 'string' ||
    typeof parsed['reason'] !== 'string'
  ) {
    throw new Error('the entry point did not print an input-error shape');
  }

  return { status: parsed['status'], reason: parsed['reason'] };
}

function readFailureReason(value: unknown): string {
  if (!isRecord(value) || typeof value['reason'] !== 'string') {
    throw new Error('a printed failure did not carry a reason');
  }

  return value['reason'];
}

function runEntryPoint(repositoryRoot: string | undefined, rawInput: string, cwd?: string) {
  const scriptPath = join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME);
  const args = repositoryRoot === undefined ? [scriptPath] : [scriptPath, repositoryRoot];

  return spawnSync(process.execPath, args, {
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

function assertInputError(run: ReturnType<typeof runEntryPoint>, messagePattern: RegExp): void {
  assert.equal(run.status, INPUT_ERROR_STATUS);
  assert.match(readInputError(run.stdout).reason, messagePattern);
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

describe('citation validator entry point: a citation naming a path that is not a readable file', () => {
  it('fails with a reason that names the path and the read failure, not a missing path', () => {
    const repository = scratchRepository();

    mkdirSync(join(repository, 'src/widget-slice'), { recursive: true });

    const entries: readonly CodeMapEntry[] = [entry({ path: 'src/widget-slice', symbols: [] })];
    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, FAILING_VERDICT_STATUS);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'fail');

    const reason = readFailureReason(verdict.failures[0]);

    assert.doesNotMatch(reason, /not found/);
    assert.match(reason, /widget-slice/);
    assert.match(reason, /could not be read/);
  });
});

describe('citation validator entry point: a bad repository root', () => {
  const wellFormedEntries = JSON.stringify([entry({ path: 'store.ts', symbols: [] })]);
  const missingOrEmptyRoots: ReadonlyArray<readonly [string, string | undefined]> = [
    ['missing', undefined],
    ['empty', ''],
  ];

  for (const [description, root] of missingOrEmptyRoots) {
    it(`reports an input error when the argument is ${description}`, () => {
      assertInputError(runEntryPoint(root, wellFormedEntries), /repository root/);
    });
  }

  it('reports an input error when the root does not exist', () => {
    const missingRoot = join(scratchRepository(), 'does-not-exist');

    assertInputError(runEntryPoint(missingRoot, wellFormedEntries), /repository root/);
  });
});

describe('citation validator entry point: a citation that escapes the repository root', () => {
  it('fails with a reason naming the escape, for a .. traversal and an absolute citation', () => {
    const { insideRoot, secretPath } = escapeFixture();
    const escapingPaths = ['../cv-outside/secret.ts', secretPath];

    for (const path of escapingPaths) {
      const entries: readonly CodeMapEntry[] = [entry({ path, symbols: ['secretThing'] })];
      const run = runEntryPoint(insideRoot, JSON.stringify(entries));

      assert.equal(run.status, FAILING_VERDICT_STATUS);

      const reason = readFailureReason(readPrintedVerdict(run.stdout).failures[0]);

      assert.match(reason, /escapes/);
      assert.doesNotMatch(reason, /not found/);
    }
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

describe('citation validator entry point: a malformed entry field', () => {
  const malformedFieldCases: ReadonlyArray<readonly [string, RegExp, Record<string, unknown>]> = [
    [
      'symbols is a comma-joined string',
      /symbols/,
      { path: 'store.ts', symbols: 'totallyFabricatedSymbol', layer: 'e', note: 'n' },
    ],
    ['symbols is absent', /symbols/, { path: 'store.ts', layer: 'e', note: 'n' }],
    [
      'symbols contains null',
      /symbols/,
      { path: 'store.ts', symbols: [null, 'Counter'], layer: 'e', note: 'n' },
    ],
    [
      'symbols contains an empty string',
      /symbols/,
      { path: 'store.ts', symbols: ['', 'Counter'], layer: 'e', note: 'n' },
    ],
    ['path is empty', /path/, { path: '', symbols: [], layer: 'e', note: 'n' }],
    ['layer is empty', /layer/, { path: 'store.ts', symbols: [], layer: '', note: 'n' }],
    ['note is empty', /note/, { path: 'store.ts', symbols: [], layer: 'e', note: '' }],
    ['note is absent', /note/, { path: 'store.ts', symbols: [], layer: 'e' }],
  ];

  for (const [description, pattern, payload] of malformedFieldCases) {
    it(`reports an input error when ${description}`, () => {
      const repository = repositoryWithFile('store.ts', 'export const Counter = 1;');

      assertInputError(runEntryPoint(repository, JSON.stringify([payload])), pattern);
    });
  }

  it('names the entry index alongside the field', () => {
    const repository = repositoryWithFile('store.ts', 'export const store = {};');
    const payload = [
      { path: 'store.ts', symbols: 'totallyFabricatedSymbol', layer: 'e', note: 'n' },
    ];
    const run = runEntryPoint(repository, JSON.stringify(payload));

    assert.match(readInputError(run.stdout).reason, /entry 0/);
  });
});

describe('citation validator entry point: input the parser cannot read', () => {
  it('reports a distinct outcome for unparsable JSON, separate from a citation failure', () => {
    const run = runEntryPoint(scratchRepository(), 'not json');

    assert.equal(run.status, INPUT_ERROR_STATUS);
    assert.notEqual(run.status, FAILING_VERDICT_STATUS);
    assert.equal(readInputError(run.stdout).status, 'error');
  });
});

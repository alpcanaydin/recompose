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

function malformedSymbolsEntry(symbols: unknown): string {
  return JSON.stringify([{ path: 'store.ts', symbols, layer: 'e', note: 'n' }]);
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

function runEntryPoint(repositoryRoot: string, rawInput: string) {
  const scriptPath = join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME);

  return spawnSync(process.execPath, [scriptPath, repositoryRoot], {
    input: rawInput,
    encoding: 'utf8',
  });
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
    const scriptPath = join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME);

    const run = spawnSync(process.execPath, [scriptPath, repository], {
      cwd: elsewhere,
      input: JSON.stringify(entries),
      encoding: 'utf8',
    });

    assert.equal(run.status, PASSING_STATUS);
    assert.equal(readPrintedVerdict(run.stdout).status, 'pass');
  });
});

describe('citation validator entry point: a citation naming a path that is not a readable file', () => {
  it('fails with a reason that names the read failure instead of claiming the path is missing', () => {
    const repository = scratchRepository();

    mkdirSync(join(repository, 'src/widget-slice'), { recursive: true });

    const entries: readonly CodeMapEntry[] = [entry({ path: 'src/widget-slice', symbols: [] })];
    const run = runEntryPoint(repository, JSON.stringify(entries));

    assert.equal(run.status, FAILING_VERDICT_STATUS);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'fail');
    assert.doesNotMatch(readFailureReason(verdict.failures[0]), /not found/);
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
});

describe('citation validator entry point: malformed symbols in the code map', () => {
  const malformedCases: ReadonlyArray<readonly [string, unknown]> = [
    ['a comma-joined string rather than an array', 'totallyFabricatedSymbol'],
    ['absent entirely', undefined],
    ['a null entry inside the array', [null, 'Counter']],
    ['an empty-string entry inside the array', ['', 'Counter']],
  ];

  for (const [description, symbols] of malformedCases) {
    it(`reports an input error when symbols is ${description}`, () => {
      const repository = repositoryWithFile('store.ts', 'export const Counter = 1;');
      const run = runEntryPoint(repository, malformedSymbolsEntry(symbols));

      assertInputError(run, /symbols/);
    });
  }

  it('names the entry index alongside the field for a malformed symbols value', () => {
    const repository = repositoryWithFile('store.ts', 'export const store = {};');
    const run = runEntryPoint(repository, malformedSymbolsEntry('totallyFabricatedSymbol'));

    assert.match(readInputError(run.stdout).reason, /entry 0/);
  });

  it('accepts an empty symbols array as a legal citation with no symbols to check', () => {
    const repository = repositoryWithFile('store.ts', 'export const store = {};');
    const run = runEntryPoint(repository, malformedSymbolsEntry([]));

    assert.equal(run.status, PASSING_STATUS);
    assert.equal(readPrintedVerdict(run.stdout).status, 'pass');
  });
});

describe('citation validator entry point: input the parser cannot read', () => {
  it('reports a distinct outcome for unparsable JSON, separate from a citation failure', () => {
    const run = runEntryPoint(scratchRepository(), 'not json');

    assert.equal(run.status, INPUT_ERROR_STATUS);
    assert.notEqual(run.status, FAILING_VERDICT_STATUS);
    assert.equal(readInputError(run.stdout).status, 'error');
  });

  it('names the missing field and the entry index when a required field is absent', () => {
    const repository = repositoryWithFile('store.ts', 'export const store = {};');
    const run = runEntryPoint(
      repository,
      JSON.stringify([{ path: 'store.ts', symbols: [], layer: 'e' }]),
    );

    assertInputError(run, /note/);
    assert.match(readInputError(run.stdout).reason, /entry 0/);
  });
});

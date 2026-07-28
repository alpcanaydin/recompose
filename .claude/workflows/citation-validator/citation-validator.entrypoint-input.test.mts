import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { CodeMapEntry } from './citation-validator.mts';

const VALIDATOR_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const VALIDATOR_SCRIPT_NAME = 'citation-validator.mts';

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

function runEntryPoint(repositoryRoot: string | undefined, rawInput: string) {
  const scriptPath = join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME);
  const args = repositoryRoot === undefined ? [scriptPath] : [scriptPath, repositoryRoot];

  return spawnSync(process.execPath, args, {
    input: rawInput,
    encoding: 'utf8',
  });
}

function assertInputError(run: ReturnType<typeof runEntryPoint>, messagePattern: RegExp): void {
  assert.equal(run.status, INPUT_ERROR_STATUS);
  assert.match(readInputError(run.stdout).reason, messagePattern);
}

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

  it('reports an input error when the root is a file rather than a directory', () => {
    const fileRoot = join(
      repositoryWithFile('real.ts', 'export function realThing() {}'),
      'real.ts',
    );

    assertInputError(runEntryPoint(fileRoot, wellFormedEntries), /repository root/);
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

  it('names the entry index alongside the field, for a malformed entry that is not first', () => {
    const repository = repositoryWithFile('store.ts', 'export const store = {};');
    const payload = [
      { path: 'store.ts', symbols: [], layer: 'e', note: 'n' },
      { path: 'store.ts', symbols: 'totallyFabricatedSymbol', layer: 'e', note: 'n' },
    ];
    const run = runEntryPoint(repository, JSON.stringify(payload));

    assert.match(readInputError(run.stdout).reason, /entry 1/);
  });
});

describe('citation validator entry point: input the parser cannot read', () => {
  it('reports a distinct outcome for unparsable JSON, separate from a citation failure', () => {
    const run = runEntryPoint(scratchRepository(), 'not json');

    assert.equal(run.status, INPUT_ERROR_STATUS);
    assert.equal(readInputError(run.stdout).status, 'error');
  });
});

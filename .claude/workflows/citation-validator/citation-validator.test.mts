import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { CodeMapEntry } from './citation-validator.mts';

import { validate } from './citation-validator.mts';

const VALIDATOR_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const VALIDATOR_SCRIPT_NAME = 'citation-validator.mts';

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

describe('citation validator: a citation naming a path the repository lacks', () => {
  it('fails and names the missing path', () => {
    const verdict = validate([entry({ path: 'src/ghost.ts' })], () => null);

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/ghost.ts');
    assert.match(failure.reason, /src\/ghost\.ts/);
  });
});

describe('citation validator: a citation naming a symbol the file lacks', () => {
  it('fails and names the missing symbol', () => {
    const verdict = validate(
      [entry({ path: 'src/widget.ts', symbols: ['renderWidget'] })],
      () => 'export function paintWidget() {}',
    );

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/widget.ts');
    assert.equal(failure.symbol, 'renderWidget');
    assert.match(failure.reason, /renderWidget/);
  });

  it('does not match a symbol that only appears as a substring of a longer token', () => {
    const verdict = validate(
      [entry({ path: 'src/widget.ts', symbols: ['foo'] })],
      () => 'export function foobar() {}',
    );

    assert.equal(verdict.status, 'fail');

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.symbol, 'foo');
  });
});

describe('citation validator: an entry whose path and every symbol resolve', () => {
  it('passes with no failures', () => {
    const verdict = validate(
      [entry({ path: 'src/widget.ts', symbols: ['renderWidget', 'WidgetProps'] })],
      () => 'export type WidgetProps = {};\nexport function renderWidget(props: WidgetProps) {}',
    );

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });

  it('passes an entry citing no symbols as long as its path resolves', () => {
    const verdict = validate([entry({ path: 'src/widget.ts', symbols: [] })], () => 'anything');

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });
});

describe('citation validator: a missing path with several cited symbols', () => {
  it('reports the path once rather than once per symbol', () => {
    const verdict = validate(
      [entry({ path: 'src/ghost.ts', symbols: ['renderWidget', 'WidgetProps', 'paintWidget'] })],
      () => null,
    );

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);

    const [failure] = verdict.failures;

    assert.ok(failure);
    assert.equal(failure.path, 'src/ghost.ts');
    assert.equal('symbol' in failure, false);
  });
});

describe('citation validator: a file the reader cannot read', () => {
  it('fails the citation the same way as a missing path', () => {
    const unreadable = validate([entry({ path: 'src/locked.ts' })], () => null);
    const missing = validate([entry({ path: 'src/ghost.ts' })], () => null);

    assert.equal(unreadable.status, 'fail');

    const [unreadableFailure] = unreadable.failures;
    const [missingFailure] = missing.failures;

    assert.ok(unreadableFailure);
    assert.ok(missingFailure);
    assert.equal(unreadableFailure.reason, missingFailure.reason.replace('ghost', 'locked'));
  });
});

describe('citation validator entry point: a code map run against a scratch repository', () => {
  it('exits non-zero and prints a failing verdict as JSON when a citation is bad', () => {
    const repository = scratchRepository();

    writeFileSync(join(repository, 'real.ts'), 'export function realThing() {}');

    const entries: readonly CodeMapEntry[] = [
      entry({ path: 'real.ts', symbols: ['realThing'] }),
      entry({ path: 'ghost.ts', symbols: [] }),
    ];

    const run = spawnSync(process.execPath, [join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME)], {
      cwd: repository,
      input: JSON.stringify(entries),
      encoding: 'utf8',
    });

    assert.notEqual(run.status, 0);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'fail');
    assert.equal(verdict.failures.length, 1);
  });

  it('exits zero and prints a passing verdict as JSON when every citation resolves', () => {
    const repository = scratchRepository();

    writeFileSync(join(repository, 'real.ts'), 'export function realThing() {}');

    const entries: readonly CodeMapEntry[] = [entry({ path: 'real.ts', symbols: ['realThing'] })];

    const run = spawnSync(process.execPath, [join(VALIDATOR_DIRECTORY, VALIDATOR_SCRIPT_NAME)], {
      cwd: repository,
      input: JSON.stringify(entries),
      encoding: 'utf8',
    });

    assert.equal(run.status, 0);

    const verdict = readPrintedVerdict(run.stdout);

    assert.equal(verdict.status, 'pass');
    assert.deepEqual(verdict.failures, []);
  });
});

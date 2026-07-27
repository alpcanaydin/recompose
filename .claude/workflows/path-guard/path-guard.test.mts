import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluate } from './path-guard.mts';

const REVIEWED = 'feature-cycle/reviewed';

const GUARD_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const GUARD_SCRIPT_NAME = 'path-guard.mts';

const scratchWorkspaces: string[] = [];

after(() => {
  for (const workspace of scratchWorkspaces) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

function aliasedGuardDirectory(): string {
  const workspace = mkdtempSync(join(tmpdir(), 'path-guard-'));
  const alias = join(workspace, 'aliased-guard');

  scratchWorkspaces.push(workspace);
  symlinkSync(GUARD_DIRECTORY, alias, 'dir');

  return alias;
}

describe('path guard: a blast-radius change without the review marker', () => {
  it('fails and lists the offending paths', () => {
    const verdict = evaluate(['apps/desktop/src/main/index.ts', 'README.md'], []);

    assert.equal(verdict.status, 'fail');
    assert.deepEqual(verdict.offendingPaths, ['apps/desktop/src/main/index.ts']);
    assert.match(verdict.reason, /apps\/desktop\/src\/main\/index\.ts/);
  });

  it('names the heavy review pass as the way to clear the guard', () => {
    const verdict = evaluate(['packages/contracts/src/ipc.ts'], []);

    assert.equal(verdict.status, 'fail');
    assert.match(verdict.reason, /review-pr/i);
    assert.match(verdict.reason, /adversarial review/i);
  });

  it('catches the workflow trees and the package manifests', () => {
    const verdict = evaluate(
      ['.github/workflows/ci.yml', '.claude/workflows/review-pr.js', 'apps/desktop/package.json'],
      [],
    );

    assert.equal(verdict.status, 'fail');
    assert.deepEqual(verdict.offendingPaths, [
      '.github/workflows/ci.yml',
      '.claude/workflows/review-pr.js',
      'apps/desktop/package.json',
    ]);
  });
});

describe('path guard: a blast-radius change carrying the review marker', () => {
  it('passes', () => {
    const verdict = evaluate(['apps/desktop/src/main/storage/vault.ts'], [REVIEWED, 'ci-success']);

    assert.equal(verdict.status, 'pass');
  });
});

describe('path guard: a change outside the blast radius', () => {
  it('passes without consulting the status list', () => {
    const verdict = evaluate(
      ['docs/guide.md', 'apps/desktop/src/renderer/src/app/main.tsx', 'README.md'],
      null,
    );

    assert.equal(verdict.status, 'pass');
  });
});

describe('path guard: a run launched through a symlinked parent', () => {
  it('still reaches the guard and reports the missing range instead of passing silently', () => {
    const run = spawnSync(process.execPath, [join(aliasedGuardDirectory(), GUARD_SCRIPT_NAME)], {
      encoding: 'utf8',
      env: { PATH: process.env['PATH'] ?? '' },
    });

    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /BASE_SHA/);
  });
});

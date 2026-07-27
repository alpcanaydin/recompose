import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluate } from './path-guard.mts';

const REVIEWED = 'feature-cycle/reviewed';

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

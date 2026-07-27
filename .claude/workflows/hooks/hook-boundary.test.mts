import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';

import {
  LINT_ERROR_SOURCE,
  outcomeForPath,
  REPOSITORY_ROOT,
  scratchDirectory,
  unrelatedRepository,
  worktreeInside,
  worktreeOfRepository,
} from './format-harness.mts';

const PERMISSIVE_LINTER_CONFIGURATION = '{ "plugins": [], "categories": {}, "rules": {} }\n';

const FORMATTER_CONFIGURATION = '{ "singleQuote": true }\n';

const PLANTED_CHECKOUT = unrelatedRepository('hook-boundary-planted-');

const PLANTED_LINTER_MARKER = join(PLANTED_CHECKOUT, 'planted-oxlint-ran');

const PLANTED_FORMATTER_MARKER = join(PLANTED_CHECKOUT, 'planted-oxfmt-ran');

const PLANTED_EDITED_FILE = join(PLANTED_CHECKOUT, 'planted-fixture.ts');

const OVERARCHING_DIRECTORY = scratchDirectory('hook-boundary-above-');

const WORKTREE_BELOW_A_CONFIGURATION = worktreeInside(OVERARCHING_DIRECTORY);

const DEEP_EDITED_FILE = join(WORKTREE_BELOW_A_CONFIGURATION, 'a', 'b', 'c', 'd', 'fixture.ts');

const UNINSTALLED_WORKTREE = worktreeOfRepository('hook-boundary-worktree-');

const WORKTREE_IGNORED_DIRECTORY = 'ignored-by-worktree';

const WORKTREE_LINTER_CONFIGURATION = JSON.stringify({
  plugins: ['typescript'],
  categories: {},
  rules: { 'typescript/no-explicit-any': 'error' },
  ignorePatterns: [`${WORKTREE_IGNORED_DIRECTORY}/**`],
});

const WORKTREE_CLEAN_FIXTURE = join(UNINSTALLED_WORKTREE, 'worktree-clean-fixture.ts');

const WORKTREE_LINT_ERROR_FIXTURE = join(UNINSTALLED_WORKTREE, 'worktree-lint-error-fixture.ts');

const WORKTREE_IGNORED_FIXTURE = join(
  UNINSTALLED_WORKTREE,
  WORKTREE_IGNORED_DIRECTORY,
  'fixture.ts',
);

const CLEAN_SOURCE = 'export const worktreeFixtureValue = 1;\n';

function plantBinary(checkout: string, binaryName: string, marker: string): void {
  const binDirectory = join(checkout, 'node_modules', '.bin');

  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(join(binDirectory, binaryName), `#!/bin/sh\ntouch '${marker}'\nexit 0\n`, {
    mode: 0o755,
  });
}

function buildPlantedCheckout(): void {
  writeFileSync(join(PLANTED_CHECKOUT, '.oxlintrc.json'), PERMISSIVE_LINTER_CONFIGURATION, 'utf8');
  writeFileSync(join(PLANTED_CHECKOUT, '.oxfmtrc.json'), FORMATTER_CONFIGURATION, 'utf8');
  plantBinary(PLANTED_CHECKOUT, 'oxlint', PLANTED_LINTER_MARKER);
  plantBinary(PLANTED_CHECKOUT, 'oxfmt', PLANTED_FORMATTER_MARKER);
  writeFileSync(PLANTED_EDITED_FILE, LINT_ERROR_SOURCE, 'utf8');
}

function buildWorktreeBelowAConfiguration(): void {
  writeFileSync(
    join(OVERARCHING_DIRECTORY, '.oxlintrc.json'),
    PERMISSIVE_LINTER_CONFIGURATION,
    'utf8',
  );
  writeFileSync(join(OVERARCHING_DIRECTORY, '.oxfmtrc.json'), FORMATTER_CONFIGURATION, 'utf8');
  mkdirSync(join(WORKTREE_BELOW_A_CONFIGURATION, 'a', 'b', 'c', 'd'), { recursive: true });
  writeFileSync(DEEP_EDITED_FILE, LINT_ERROR_SOURCE, 'utf8');
}

function buildUninstalledWorktree(): void {
  writeFileSync(
    join(UNINSTALLED_WORKTREE, '.oxlintrc.json'),
    WORKTREE_LINTER_CONFIGURATION,
    'utf8',
  );
  writeFileSync(join(UNINSTALLED_WORKTREE, '.oxfmtrc.json'), FORMATTER_CONFIGURATION, 'utf8');
  writeFileSync(WORKTREE_CLEAN_FIXTURE, CLEAN_SOURCE, 'utf8');
  writeFileSync(WORKTREE_LINT_ERROR_FIXTURE, LINT_ERROR_SOURCE, 'utf8');
  mkdirSync(join(UNINSTALLED_WORKTREE, WORKTREE_IGNORED_DIRECTORY), { recursive: true });
  writeFileSync(WORKTREE_IGNORED_FIXTURE, LINT_ERROR_SOURCE, 'utf8');
}

before(() => {
  buildPlantedCheckout();
  buildWorktreeBelowAConfiguration();
  buildUninstalledWorktree();
});

describe('post-edit format hook: an edit inside a worktree that has no dependencies installed', () => {
  it('lets a clean source file stand rather than failing to start a linter', () => {
    const outcome = outcomeForPath(WORKTREE_CLEAN_FIXTURE, REPOSITORY_ROOT);

    assert.equal(outcome.status, 0);
  });

  it('honours the ignore list that worktree own linter configuration carries', () => {
    assert.equal(outcomeForPath(WORKTREE_IGNORED_FIXTURE, REPOSITORY_ROOT).status, 0);
  });

  it('blocks a source file carrying a lint error and names the rule it broke', () => {
    const outcome = outcomeForPath(WORKTREE_LINT_ERROR_FIXTURE, REPOSITORY_ROOT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
  });
});

describe('post-edit format hook: an edit inside a repository that is not this one', () => {
  it('never starts the planted linter', () => {
    outcomeForPath(PLANTED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(existsSync(PLANTED_LINTER_MARKER), false);
  });

  it('never starts the planted formatter', () => {
    outcomeForPath(PLANTED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(existsSync(PLANTED_FORMATTER_MARKER), false);
  });

  it('judges the file under the repository own linter and blocks the edit', () => {
    const outcome = outcomeForPath(PLANTED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
  });
});

describe('post-edit format hook: an edit inside a worktree the configuration sits above', () => {
  it('stops climbing at the worktree root and keeps the repository own linter', () => {
    const outcome = outcomeForPath(DEEP_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
  });
});

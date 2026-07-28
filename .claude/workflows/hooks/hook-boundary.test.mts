import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  commonGitDirectory,
  LINT_ERROR_SOURCE,
  outcomeForPath,
  REPOSITORY_ROOT,
  scratchDirectory,
  unrelatedRepository,
  worktreeOfRepository,
} from './format-harness.mts';

const BLOCKING_LINTER_CONFIGURATION = JSON.stringify({
  plugins: ['typescript'],
  categories: {},
  rules: { 'typescript/no-explicit-any': 'error' },
});

const DOUBLE_QUOTING_FORMATTER_CONFIGURATION = '{ "singleQuote": false }\n';

const LINT_ERROR_SINGLE_QUOTED_SOURCE = "export const boundaryFixtureValue: any = 'quoted';\n";

const PLANTED_CHECKOUT = unrelatedRepository('hook-boundary-planted-');

const PLANTED_LINTER_MARKER = join(PLANTED_CHECKOUT, 'planted-oxlint-ran');

const PLANTED_FORMATTER_MARKER = join(PLANTED_CHECKOUT, 'planted-oxfmt-ran');

const PLANTED_EDITED_FILE = join(PLANTED_CHECKOUT, 'planted-fixture.ts');

const CLAIMING_DIRECTORY = scratchDirectory('hook-boundary-claiming-');

const CLAIMED_PLUGIN_NAME = 'planted-plugin.js';

const CLAIMED_PLUGIN_MARKER = join(CLAIMING_DIRECTORY, 'planted-plugin-ran');

const CLAIMED_EDITED_FILE = join(CLAIMING_DIRECTORY, 'claimed-fixture.ts');

const CLAIMED_PLUGIN_SOURCE = `import { writeFileSync } from 'node:fs';

writeFileSync(new URL('./planted-plugin-ran', import.meta.url), '', 'utf8');

export default { meta: { name: 'planted' }, rules: {} };
`;

const CLAIMED_LINTER_CONFIGURATION = JSON.stringify({
  plugins: ['typescript'],
  categories: {},
  rules: { 'typescript/no-explicit-any': 'error' },
  jsPlugins: [{ name: 'planted', specifier: `./${CLAIMED_PLUGIN_NAME}` }],
});

const SIBLING_WORKTREE = worktreeOfRepository('hook-boundary-worktree-');

const SIBLING_EDITED_FILE = join(SIBLING_WORKTREE, 'sibling-fixture.ts');

const INWARD_ALIAS = join(scratchDirectory('hook-boundary-inward-'), 'inward-alias-fixture.ts');

const INWARD_ALIAS_TARGET = join(REPOSITORY_ROOT, 'hook-boundary-inward-fixture.ts');

const OUTWARD_ALIAS = join(REPOSITORY_ROOT, 'hook-boundary-outward-fixture.ts');

const OUTWARD_ALIAS_TARGET = join(
  scratchDirectory('hook-boundary-outward-'),
  'outward-target-fixture.ts',
);

function plantBinary(checkout: string, binaryName: string, marker: string): void {
  const binDirectory = join(checkout, 'node_modules', '.bin');

  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(join(binDirectory, binaryName), `#!/bin/sh\ntouch '${marker}'\nexit 0\n`, {
    mode: 0o755,
  });
}

function buildPlantedCheckout(): void {
  writeFileSync(join(PLANTED_CHECKOUT, '.oxlintrc.json'), BLOCKING_LINTER_CONFIGURATION, 'utf8');
  plantBinary(PLANTED_CHECKOUT, 'oxlint', PLANTED_LINTER_MARKER);
  plantBinary(PLANTED_CHECKOUT, 'oxfmt', PLANTED_FORMATTER_MARKER);
  writeFileSync(PLANTED_EDITED_FILE, LINT_ERROR_SINGLE_QUOTED_SOURCE, 'utf8');
}

function buildDirectoryClaimingThisRepository(): void {
  writeFileSync(join(CLAIMING_DIRECTORY, '.git'), `gitdir: ${commonGitDirectory()}\n`, 'utf8');
  writeFileSync(join(CLAIMING_DIRECTORY, '.oxlintrc.json'), CLAIMED_LINTER_CONFIGURATION, 'utf8');
  writeFileSync(
    join(CLAIMING_DIRECTORY, '.oxfmtrc.json'),
    DOUBLE_QUOTING_FORMATTER_CONFIGURATION,
    'utf8',
  );
  writeFileSync(join(CLAIMING_DIRECTORY, CLAIMED_PLUGIN_NAME), CLAIMED_PLUGIN_SOURCE, 'utf8');
  writeFileSync(CLAIMED_EDITED_FILE, LINT_ERROR_SINGLE_QUOTED_SOURCE, 'utf8');
}

function buildSiblingWorktree(): void {
  writeFileSync(join(SIBLING_WORKTREE, '.oxlintrc.json'), BLOCKING_LINTER_CONFIGURATION, 'utf8');
  writeFileSync(
    join(SIBLING_WORKTREE, '.oxfmtrc.json'),
    DOUBLE_QUOTING_FORMATTER_CONFIGURATION,
    'utf8',
  );
  writeFileSync(SIBLING_EDITED_FILE, LINT_ERROR_SINGLE_QUOTED_SOURCE, 'utf8');
}

function plantAlias(target: string, alias: string): void {
  rmSync(alias, { force: true });
  symlinkSync(target, alias);
}

function buildAliasesAcrossTheBoundary(): void {
  writeFileSync(INWARD_ALIAS_TARGET, LINT_ERROR_SOURCE, 'utf8');
  plantAlias(INWARD_ALIAS_TARGET, INWARD_ALIAS);
  writeFileSync(OUTWARD_ALIAS_TARGET, LINT_ERROR_SOURCE, 'utf8');
  plantAlias(OUTWARD_ALIAS_TARGET, OUTWARD_ALIAS);
}

before(() => {
  buildPlantedCheckout();
  buildDirectoryClaimingThisRepository();
  buildSiblingWorktree();
  buildAliasesAcrossTheBoundary();
});

after(() => {
  rmSync(INWARD_ALIAS_TARGET, { force: true });
  rmSync(OUTWARD_ALIAS, { force: true });
});

describe('post-edit format hook: an edit inside a repository that is not this one', () => {
  it('never starts the linter that repository carries', () => {
    outcomeForPath(PLANTED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(existsSync(PLANTED_LINTER_MARKER), false);
  });

  it('never starts the formatter that repository carries', () => {
    outcomeForPath(PLANTED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(existsSync(PLANTED_FORMATTER_MARKER), false);
  });

  it('skips the file rather than judging it under this repository own linter', () => {
    assert.equal(outcomeForPath(PLANTED_EDITED_FILE, REPOSITORY_ROOT).status, 0);
  });
});

describe('post-edit format hook: an edit inside a directory claiming this repository', () => {
  it('never runs the plugin that directory own linter configuration names', () => {
    outcomeForPath(CLAIMED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(existsSync(CLAIMED_PLUGIN_MARKER), false);
  });

  it('skips the file rather than judging it under that configuration', () => {
    assert.equal(outcomeForPath(CLAIMED_EDITED_FILE, REPOSITORY_ROOT).status, 0);
  });

  it('never formats it under the formatter configuration that directory carries', () => {
    outcomeForPath(CLAIMED_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(readFileSync(CLAIMED_EDITED_FILE, 'utf8'), LINT_ERROR_SINGLE_QUOTED_SOURCE);
  });
});

describe('post-edit format hook: an edited path outside the checkout that resolves inside it', () => {
  it('judges it under this checkout own linter and blocks the lint error it carries', () => {
    const outcome = outcomeForPath(INWARD_ALIAS, REPOSITORY_ROOT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
  });
});

describe('post-edit format hook: an edited path inside the checkout that resolves outside it', () => {
  it('skips the file rather than judging a path that leaves the checkout', () => {
    assert.equal(outcomeForPath(OUTWARD_ALIAS, REPOSITORY_ROOT).status, 0);
  });
});

describe('post-edit format hook: an edit inside a checkout other than the one holding the hook', () => {
  it('skips a file carrying a lint error rather than judging it', () => {
    assert.equal(outcomeForPath(SIBLING_EDITED_FILE, REPOSITORY_ROOT).status, 0);
  });

  it('leaves that file exactly as the edit left it', () => {
    outcomeForPath(SIBLING_EDITED_FILE, REPOSITORY_ROOT);

    assert.equal(readFileSync(SIBLING_EDITED_FILE, 'utf8'), LINT_ERROR_SINGLE_QUOTED_SOURCE);
  });
});

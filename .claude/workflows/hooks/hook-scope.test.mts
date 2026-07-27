import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  configuredHook,
  isRecord,
  LINT_ERROR_SOURCE,
  outcomeForPath,
  readProperty,
  readStrings,
  REPOSITORY_ROOT,
  runHook,
  scratchDirectory,
  worktreeOfRepository,
} from './format-harness.mts';

const GATED_TOOL_MATCHER = 'Edit|Write|NotebookEdit';

const LAUNCHER_SCRIPT_NAME = 'launch-gate.mjs';

const IGNORED_FIXTURE = '.claude/workflows/hook-scope-ignored-fixture.ts';

const CLEAN_FIXTURE = 'hook-scope-clean-fixture.ts';

const LINT_ERROR_FIXTURE = 'hook-scope-lint-error-fixture.ts';

const LINT_ERROR_MODULE_FIXTURE = 'hook-scope-lint-error-fixture.mts';

const CLEAN_FIXTURE_SOURCE = 'export const hookScopeFixtureValue = 1;\n';

const DIRECTORY_OUTSIDE_CHECKOUT = scratchDirectory('hook-scope-');

const UNANCHORED_LINT_ERROR_FIXTURE = join(DIRECTORY_OUTSIDE_CHECKOUT, 'unanchored-fixture.ts');

const SIBLING_CHECKOUT = worktreeOfRepository('hook-scope-sibling-');

const SIBLING_CLEAN_FIXTURE = join(SIBLING_CHECKOUT, 'sibling-clean-fixture.ts');

const SIBLING_LINT_ERROR_FIXTURE = join(SIBLING_CHECKOUT, 'sibling-lint-error-fixture.ts');

const SIBLING_IGNORED_DIRECTORY = 'ignored-by-sibling';

const SIBLING_IGNORED_FIXTURE = join(SIBLING_CHECKOUT, SIBLING_IGNORED_DIRECTORY, 'fixture.ts');

const SIBLING_FORMATTER_CONFIGURATION = '{ "singleQuote": false }\n';

const SIBLING_UNFORMATTED_SOURCE = "export const siblingFixtureValue = 'quoted';\n";

const SIBLING_FORMATTED_SOURCE = 'export const siblingFixtureValue = "quoted";\n';

function fixturePath(relativePath: string): string {
  return join(REPOSITORY_ROOT, relativePath);
}

function exitCodeForPath(editedPath: string, workingDirectory: string): number {
  return outcomeForPath(editedPath, workingDirectory).status;
}

function exitCodeForEditedFile(relativePath: string, workingDirectory: string): number {
  return exitCodeForPath(fixturePath(relativePath), workingDirectory);
}

function siblingLinterConfiguration(): string {
  const configuration: unknown = JSON.parse(readFileSync(fixturePath('.oxlintrc.json'), 'utf8'));

  return JSON.stringify({
    ...(isRecord(configuration) ? configuration : {}),
    ignorePatterns: [
      ...readStrings(readProperty(configuration, 'ignorePatterns')),
      `${SIBLING_IGNORED_DIRECTORY}/**`,
    ],
  });
}

function buildSiblingCheckout(): void {
  writeFileSync(join(SIBLING_CHECKOUT, '.oxlintrc.json'), siblingLinterConfiguration(), 'utf8');
  writeFileSync(join(SIBLING_CHECKOUT, '.oxfmtrc.json'), SIBLING_FORMATTER_CONFIGURATION, 'utf8');
  symlinkSync(fixturePath('node_modules'), join(SIBLING_CHECKOUT, 'node_modules'), 'dir');
  writeFileSync(SIBLING_CLEAN_FIXTURE, SIBLING_UNFORMATTED_SOURCE, 'utf8');
  writeFileSync(SIBLING_LINT_ERROR_FIXTURE, LINT_ERROR_SOURCE, 'utf8');
  mkdirSync(join(SIBLING_CHECKOUT, SIBLING_IGNORED_DIRECTORY), { recursive: true });
  writeFileSync(SIBLING_IGNORED_FIXTURE, LINT_ERROR_SOURCE, 'utf8');
}

before(() => {
  writeFileSync(fixturePath(IGNORED_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
  writeFileSync(fixturePath(CLEAN_FIXTURE), CLEAN_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
  writeFileSync(UNANCHORED_LINT_ERROR_FIXTURE, LINT_ERROR_SOURCE, 'utf8');
  buildSiblingCheckout();
});

after(() => {
  rmSync(fixturePath(IGNORED_FIXTURE), { force: true });
  rmSync(fixturePath(CLEAN_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), { force: true });
});

describe('post-edit format hook: an edited script the linter is configured to ignore', () => {
  it('lets the edit stand', () => {
    assert.equal(exitCodeForEditedFile(IGNORED_FIXTURE, REPOSITORY_ROOT), 0);
  });
});

describe('post-edit format hook: an edited source file the linter finds clean', () => {
  it('lets the edit stand', () => {
    assert.equal(exitCodeForEditedFile(CLEAN_FIXTURE, REPOSITORY_ROOT), 0);
  });
});

describe('post-edit format hook: an edited source file carrying a lint error', () => {
  it('blocks the edit', () => {
    assert.equal(exitCodeForEditedFile(LINT_ERROR_FIXTURE, REPOSITORY_ROOT), 2);
  });
});

describe('post-edit format hook: an edited module script carrying a lint error', () => {
  it('blocks the edit', () => {
    assert.equal(exitCodeForEditedFile(LINT_ERROR_MODULE_FIXTURE, REPOSITORY_ROOT), 2);
  });
});

describe('post-edit format hook: an edit made from a working directory outside the checkout', () => {
  it('keeps the linter configuration that ignores the path', () => {
    assert.equal(exitCodeForEditedFile(IGNORED_FIXTURE, DIRECTORY_OUTSIDE_CHECKOUT), 0);
  });

  it('lets a clean source file stand', () => {
    assert.equal(exitCodeForEditedFile(CLEAN_FIXTURE, DIRECTORY_OUTSIDE_CHECKOUT), 0);
  });

  it('blocks a source file carrying a lint error', () => {
    assert.equal(exitCodeForEditedFile(LINT_ERROR_FIXTURE, DIRECTORY_OUTSIDE_CHECKOUT), 2);
  });
});

describe('post-edit format hook: an edit inside a checkout other than the session one', () => {
  it('lets a clean source file stand', () => {
    assert.equal(exitCodeForPath(SIBLING_CLEAN_FIXTURE, REPOSITORY_ROOT), 0);
  });

  it('honours the ignore list that checkout own linter configuration carries', () => {
    assert.equal(exitCodeForPath(SIBLING_IGNORED_FIXTURE, REPOSITORY_ROOT), 0);
  });

  it('formats it under the formatter configuration that checkout carries', () => {
    exitCodeForPath(SIBLING_CLEAN_FIXTURE, REPOSITORY_ROOT);

    assert.equal(readFileSync(SIBLING_CLEAN_FIXTURE, 'utf8'), SIBLING_FORMATTED_SOURCE);
  });

  it('blocks a source file carrying a lint error and names the rule it broke', () => {
    const outcome = outcomeForPath(SIBLING_LINT_ERROR_FIXTURE, REPOSITORY_ROOT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
  });

  it('lets a clean source file stand from a working directory outside every checkout', () => {
    assert.equal(exitCodeForPath(SIBLING_CLEAN_FIXTURE, DIRECTORY_OUTSIDE_CHECKOUT), 0);
  });
});

describe('post-edit format hook: an edit no checkout configuration covers', () => {
  it('falls back to the checkout owning the hook and still blocks a lint error', () => {
    const outcome = outcomeForPath(UNANCHORED_LINT_ERROR_FIXTURE, DIRECTORY_OUTSIDE_CHECKOUT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
  });
});

describe('test-first gate hook: a tool call made from a working directory outside the checkout', () => {
  it('reaches the gate and blocks the tool call', () => {
    const outcome = runHook(
      configuredHook('PreToolUse', GATED_TOOL_MATCHER, LAUNCHER_SCRIPT_NAME),
      DIRECTORY_OUTSIDE_CHECKOUT,
      'not a hook payload',
    );

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /the test-first gate never ran/);
  });
});

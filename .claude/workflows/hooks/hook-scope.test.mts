import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  configuredHook,
  LINT_ERROR_SOURCE,
  outcomeForPath,
  REPOSITORY_ROOT,
  runHook,
  scratchDirectory,
} from './format-harness.mts';

const GATED_TOOL_MATCHER = 'Edit|Write|NotebookEdit';

const LAUNCHER_SCRIPT_NAME = 'launch-gate.mjs';

const IGNORED_FIXTURE = '.claude/workflows/hook-scope-ignored-fixture.ts';

const CLEAN_FIXTURE = 'hook-scope-clean-fixture.ts';

const UNFORMATTED_FIXTURE = 'hook-scope-unformatted-fixture.ts';

const LINT_ERROR_FIXTURE = 'hook-scope-lint-error-fixture.ts';

const LINT_ERROR_MODULE_FIXTURE = 'hook-scope-lint-error-fixture.mts';

const CLEAN_FIXTURE_SOURCE = 'export const hookScopeFixtureValue = 1;\n';

const DOUBLE_QUOTED_SOURCE = 'export const hookScopeQuotedValue = "quoted";\n';

const SINGLE_QUOTED_SOURCE = "export const hookScopeQuotedValue = 'quoted';\n";

const DIRECTORY_OUTSIDE_CHECKOUT = scratchDirectory('hook-scope-');

function fixturePath(relativePath: string): string {
  return join(REPOSITORY_ROOT, relativePath);
}

function exitCodeForEditedFile(relativePath: string, workingDirectory: string): number {
  return outcomeForPath(fixturePath(relativePath), workingDirectory).status;
}

before(() => {
  writeFileSync(fixturePath(IGNORED_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
  writeFileSync(fixturePath(CLEAN_FIXTURE), CLEAN_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(UNFORMATTED_FIXTURE), DOUBLE_QUOTED_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
});

after(() => {
  rmSync(fixturePath(IGNORED_FIXTURE), { force: true });
  rmSync(fixturePath(CLEAN_FIXTURE), { force: true });
  rmSync(fixturePath(UNFORMATTED_FIXTURE), { force: true });
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

describe('post-edit format hook: an edited source file the checkout formatter would rewrite', () => {
  it('formats it under the checkout own formatter configuration', () => {
    outcomeForPath(fixturePath(UNFORMATTED_FIXTURE), REPOSITORY_ROOT);

    assert.equal(readFileSync(fixturePath(UNFORMATTED_FIXTURE), 'utf8'), SINGLE_QUOTED_SOURCE);
  });
});

describe('post-edit format hook: an edited source file carrying a lint error', () => {
  it('blocks the edit and names the rule it broke', () => {
    const outcome = outcomeForPath(fixturePath(LINT_ERROR_FIXTURE), REPOSITORY_ROOT);

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /no-explicit-any/);
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

describe('post-edit format hook: an edited path named relative to the checkout', () => {
  it('reads that path against the checkout holding the hook and still blocks a lint error', () => {
    const outcome = outcomeForPath(LINT_ERROR_FIXTURE, DIRECTORY_OUTSIDE_CHECKOUT);

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

describe('Claude command hook configuration', () => {
  it('keeps each script in the command string Claude Code executes', () => {
    const preToolUse = configuredHook('PreToolUse', GATED_TOOL_MATCHER, LAUNCHER_SCRIPT_NAME);
    const postToolUse = configuredHook('PostToolUse', 'Edit|Write', 'format-edit.mts');

    assert.match(preToolUse.command, /^node .+launch-gate\.mjs/u);
    assert.match(postToolUse.command, /^node .+format-edit\.mts/u);
  });
});

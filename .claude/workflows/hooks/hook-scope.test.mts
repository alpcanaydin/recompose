import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const EDITING_TOOL_MATCHER = 'Edit|Write';

const LINTER_BINARY = 'oxlint';

const IGNORED_FIXTURE = '.claude/workflows/hooks/hook-scope-ignored-fixture.ts';

const CLEAN_FIXTURE = 'hook-scope-clean-fixture.ts';

const LINT_ERROR_FIXTURE = 'hook-scope-lint-error-fixture.ts';

const CLEAN_FIXTURE_SOURCE = 'export const hookScopeFixtureValue = 1;\n';

const LINT_ERROR_FIXTURE_SOURCE = 'export const hookScopeFixtureValue: any = 1;\n';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readProperty(value: unknown, property: string): unknown {
  return isRecord(value) ? value[property] : undefined;
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function readList(value: unknown): readonly unknown[] {
  return isList(value) ? value : [];
}

function readEditFormatCommand(): string {
  const settings: unknown = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, '.claude', 'settings.json'), 'utf8'),
  );
  const command = readList(readProperty(readProperty(settings, 'hooks'), 'PostToolUse'))
    .filter((entry) => readProperty(entry, 'matcher') === EDITING_TOOL_MATCHER)
    .flatMap((entry) => readList(readProperty(entry, 'hooks')))
    .map((hook) => readProperty(hook, 'command'))
    .find((candidate) => typeof candidate === 'string' && candidate.includes(LINTER_BINARY));

  if (typeof command !== 'string') {
    throw new Error(
      `.claude/settings.json carries no ${EDITING_TOOL_MATCHER} PostToolUse command running ${LINTER_BINARY}`,
    );
  }

  return command;
}

function fixturePath(relativePath: string): string {
  return join(REPOSITORY_ROOT, relativePath);
}

function exitCodeForEditedFile(relativePath: string): number {
  const run = spawnSync(readEditFormatCommand(), {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { file_path: fixturePath(relativePath) } }),
    shell: true,
  });

  if (run.status === null) {
    throw new Error(`the post-edit format hook was killed before it reported on ${relativePath}`);
  }

  return run.status;
}

before(() => {
  writeFileSync(fixturePath(IGNORED_FIXTURE), CLEAN_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(CLEAN_FIXTURE), CLEAN_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
});

after(() => {
  rmSync(fixturePath(IGNORED_FIXTURE), { force: true });
  rmSync(fixturePath(CLEAN_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_FIXTURE), { force: true });
});

describe('post-edit format hook: an edited script the linter is configured to ignore', () => {
  it('lets the edit stand', () => {
    assert.equal(exitCodeForEditedFile(IGNORED_FIXTURE), 0);
  });
});

describe('post-edit format hook: an edited source file the linter finds clean', () => {
  it('lets the edit stand', () => {
    assert.equal(exitCodeForEditedFile(CLEAN_FIXTURE), 0);
  });
});

describe('post-edit format hook: an edited source file carrying a lint error', () => {
  it('blocks the edit', () => {
    assert.equal(exitCodeForEditedFile(LINT_ERROR_FIXTURE), 2);
  });
});

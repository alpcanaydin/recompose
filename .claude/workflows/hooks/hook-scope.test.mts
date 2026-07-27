import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const PROJECT_DIRECTORY_PLACEHOLDER = '${CLAUDE_PROJECT_DIR}';

const EDITING_TOOL_MATCHER = 'Edit|Write';

const GATED_TOOL_MATCHER = 'Edit|Write|NotebookEdit';

const LINTER_BINARY = 'oxlint';

const LAUNCHER_SCRIPT_NAME = 'launch-gate.mjs';

const IGNORED_FIXTURE = '.claude/workflows/hook-scope-ignored-fixture.ts';

const CLEAN_FIXTURE = 'hook-scope-clean-fixture.ts';

const LINT_ERROR_FIXTURE = 'hook-scope-lint-error-fixture.ts';

const LINT_ERROR_MODULE_FIXTURE = 'hook-scope-lint-error-fixture.mts';

const CLEAN_FIXTURE_SOURCE = 'export const hookScopeFixtureValue = 1;\n';

const LINT_ERROR_FIXTURE_SOURCE = 'export const hookScopeFixtureValue: any = 1;\n';

const DIRECTORY_OUTSIDE_CHECKOUT = mkdtempSync(join(tmpdir(), 'hook-scope-'));

type ConfiguredHook = {
  readonly command: string;
  readonly args: readonly string[] | undefined;
};

type HookOutcome = {
  readonly stderr: string;
  readonly status: number;
};

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

function readStrings(value: unknown): readonly string[] {
  return readList(value).filter((item): item is string => typeof item === 'string');
}

function hookNamesTarget(candidate: unknown, marker: string): boolean {
  const command = readProperty(candidate, 'command');
  const launcher = typeof command === 'string' ? [command] : [];

  return [...launcher, ...readStrings(readProperty(candidate, 'args'))].some((piece) =>
    piece.includes(marker),
  );
}

function configuredHook(event: string, matcher: string, marker: string): ConfiguredHook {
  const settings: unknown = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, '.claude', 'settings.json'), 'utf8'),
  );
  const hook = readList(readProperty(readProperty(settings, 'hooks'), event))
    .filter((entry) => readProperty(entry, 'matcher') === matcher)
    .flatMap((entry) => readList(readProperty(entry, 'hooks')))
    .find((candidate) => hookNamesTarget(candidate, marker));
  const command = readProperty(hook, 'command');

  if (typeof command !== 'string') {
    throw new Error(`.claude/settings.json carries no ${matcher} ${event} hook running ${marker}`);
  }

  const args = readProperty(hook, 'args');

  return { command, args: isList(args) ? readStrings(args) : undefined };
}

function withProjectDirectory(value: string): string {
  return value.replaceAll(PROJECT_DIRECTORY_PLACEHOLDER, REPOSITORY_ROOT);
}

function runHook(hook: ConfiguredHook, workingDirectory: string, payload: string): HookOutcome {
  const args = hook.args?.map(withProjectDirectory);
  const run = spawnSync(withProjectDirectory(hook.command), args ?? [], {
    cwd: workingDirectory,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPOSITORY_ROOT },
    input: payload,
    shell: args === undefined,
  });

  if (run.status === null) {
    throw new Error('the hook was killed before it reported');
  }

  return { stderr: run.stderr, status: run.status };
}

function fixturePath(relativePath: string): string {
  return join(REPOSITORY_ROOT, relativePath);
}

function exitCodeForEditedFile(relativePath: string, workingDirectory: string): number {
  return runHook(
    configuredHook('PostToolUse', EDITING_TOOL_MATCHER, LINTER_BINARY),
    workingDirectory,
    JSON.stringify({ tool_input: { file_path: fixturePath(relativePath) } }),
  ).status;
}

before(() => {
  writeFileSync(fixturePath(IGNORED_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(CLEAN_FIXTURE), CLEAN_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
});

after(() => {
  rmSync(fixturePath(IGNORED_FIXTURE), { force: true });
  rmSync(fixturePath(CLEAN_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), { force: true });
  rmSync(DIRECTORY_OUTSIDE_CHECKOUT, { recursive: true, force: true });
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

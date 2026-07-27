import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const PROJECT_DIRECTORY_PLACEHOLDER = '${CLAUDE_PROJECT_DIR}';

const EDITING_TOOL_MATCHER = 'Edit|Write';

const GATED_TOOL_MATCHER = 'Edit|Write|NotebookEdit';

const FORMAT_SCRIPT_NAME = 'format-edit.mts';

const LAUNCHER_SCRIPT_NAME = 'launch-gate.mjs';

const IGNORED_FIXTURE = '.claude/workflows/hook-scope-ignored-fixture.ts';

const CLEAN_FIXTURE = 'hook-scope-clean-fixture.ts';

const LINT_ERROR_FIXTURE = 'hook-scope-lint-error-fixture.ts';

const LINT_ERROR_MODULE_FIXTURE = 'hook-scope-lint-error-fixture.mts';

const CLEAN_FIXTURE_SOURCE = 'export const hookScopeFixtureValue = 1;\n';

const LINT_ERROR_FIXTURE_SOURCE = 'export const hookScopeFixtureValue: any = 1;\n';

const DIRECTORY_OUTSIDE_CHECKOUT = mkdtempSync(join(tmpdir(), 'hook-scope-'));

const UNANCHORED_LINT_ERROR_FIXTURE = join(DIRECTORY_OUTSIDE_CHECKOUT, 'unanchored-fixture.ts');

const SIBLING_CHECKOUT = mkdtempSync(join(tmpdir(), 'hook-scope-sibling-'));

const SIBLING_CLEAN_FIXTURE = join(SIBLING_CHECKOUT, 'sibling-clean-fixture.ts');

const SIBLING_LINT_ERROR_FIXTURE = join(SIBLING_CHECKOUT, 'sibling-lint-error-fixture.ts');

const SIBLING_IGNORED_DIRECTORY = 'ignored-by-sibling';

const SIBLING_IGNORED_FIXTURE = join(SIBLING_CHECKOUT, SIBLING_IGNORED_DIRECTORY, 'fixture.ts');

const SIBLING_FORMATTER_CONFIGURATION = '{ "singleQuote": false }\n';

const SIBLING_UNFORMATTED_SOURCE = "export const siblingFixtureValue = 'quoted';\n";

const SIBLING_FORMATTED_SOURCE = 'export const siblingFixtureValue = "quoted";\n';

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

function outcomeForPath(editedPath: string, workingDirectory: string): HookOutcome {
  return runHook(
    configuredHook('PostToolUse', EDITING_TOOL_MATCHER, FORMAT_SCRIPT_NAME),
    workingDirectory,
    JSON.stringify({ tool_input: { file_path: editedPath } }),
  );
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
  writeFileSync(SIBLING_LINT_ERROR_FIXTURE, LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  mkdirSync(join(SIBLING_CHECKOUT, SIBLING_IGNORED_DIRECTORY), { recursive: true });
  writeFileSync(SIBLING_IGNORED_FIXTURE, LINT_ERROR_FIXTURE_SOURCE, 'utf8');
}

before(() => {
  writeFileSync(fixturePath(IGNORED_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(CLEAN_FIXTURE), CLEAN_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  writeFileSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  writeFileSync(UNANCHORED_LINT_ERROR_FIXTURE, LINT_ERROR_FIXTURE_SOURCE, 'utf8');
  buildSiblingCheckout();
});

after(() => {
  rmSync(fixturePath(IGNORED_FIXTURE), { force: true });
  rmSync(fixturePath(CLEAN_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_FIXTURE), { force: true });
  rmSync(fixturePath(LINT_ERROR_MODULE_FIXTURE), { force: true });
  rmSync(DIRECTORY_OUTSIDE_CHECKOUT, { recursive: true, force: true });
  rmSync(SIBLING_CHECKOUT, { recursive: true, force: true });
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

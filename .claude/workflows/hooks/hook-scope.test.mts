import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

type PostToolUseEntry = {
  matcher: string;
  hooks: { command: string }[];
};

type Settings = {
  hooks: { PostToolUse: PostToolUseEntry[] };
};

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const IGNORED_SCRIPT = '.claude/workflows/review-pr.js';

const CLEAN_SOURCE_FILE = 'vitest.shared.ts';

const LINT_ERROR_FIXTURE = 'hook-scope-lint-error-fixture.ts';

const LINT_ERROR_SOURCE = 'const first = 1;\nconst second = 2;\nexport default first + second;\n';

function readEditFormatCommand(): string {
  const settings: Settings = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, '.claude', 'settings.json'), 'utf8'),
  );
  const command = settings.hooks.PostToolUse.find(
    (entry) => entry.matcher === 'Edit|Write',
  )?.hooks[0]?.command;

  if (command === undefined) {
    throw new Error('.claude/settings.json carries no Edit|Write PostToolUse command');
  }

  return command;
}

function exitCodeForEditedFile(relativePath: string): number {
  const run = spawnSync(readEditFormatCommand(), {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { file_path: join(REPOSITORY_ROOT, relativePath) } }),
    shell: true,
  });

  if (run.status === null) {
    throw new Error(`the post-edit format hook was killed before it reported on ${relativePath}`);
  }

  return run.status;
}

describe('post-edit format hook: an edited script the linter is configured to ignore', () => {
  it('lets the edit stand', () => {
    assert.equal(exitCodeForEditedFile(IGNORED_SCRIPT), 0);
  });
});

describe('post-edit format hook: an edited source file the linter finds clean', () => {
  it('lets the edit stand', () => {
    assert.equal(exitCodeForEditedFile(CLEAN_SOURCE_FILE), 0);
  });
});

describe('post-edit format hook: an edited source file carrying a lint error', () => {
  before(() => {
    writeFileSync(join(REPOSITORY_ROOT, LINT_ERROR_FIXTURE), LINT_ERROR_SOURCE, 'utf8');
  });

  after(() => {
    rmSync(join(REPOSITORY_ROOT, LINT_ERROR_FIXTURE), { force: true });
  });

  it('blocks the edit', () => {
    assert.equal(exitCodeForEditedFile(LINT_ERROR_FIXTURE), 2);
  });
});

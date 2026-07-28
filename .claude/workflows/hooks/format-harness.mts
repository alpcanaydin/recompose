import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';

export type HookOutcome = {
  readonly stderr: string;
  readonly status: number;
};

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const LINT_ERROR_SOURCE = 'export const hookScopeFixtureValue: any = 1;\n';

const EDITING_TOOL_MATCHER = 'Edit|Write';

const PROJECT_DIRECTORY_PLACEHOLDER = '${CLAUDE_PROJECT_DIR}';

const FORMAT_SCRIPT_NAME = 'format-edit.mts';

const scratchDirectories: string[] = [];

const registeredWorktrees: string[] = [];

function runGit(args: readonly string[]): { status: number | null; stderr: string } {
  const run = spawnSync('git', [...args], { cwd: REPOSITORY_ROOT, encoding: 'utf8' });

  return { status: run.status, stderr: run.stderr };
}

after(() => {
  for (const worktree of registeredWorktrees) {
    runGit(['worktree', 'remove', '--force', worktree]);
  }

  for (const directory of scratchDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }

  runGit(['worktree', 'prune']);
});

export function scratchDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));

  scratchDirectories.push(directory);

  return directory;
}

export function worktreeOfRepository(prefix: string): string {
  return worktreeInside(scratchDirectory(prefix));
}

function worktreeInside(parent: string): string {
  const root = join(parent, 'worktree');
  const add = runGit(['worktree', 'add', '--no-checkout', '--detach', root]);

  if (add.status !== 0) {
    throw new Error(`the fixture worktree at ${root} was not created: ${add.stderr}`);
  }

  registeredWorktrees.push(root);

  return root;
}

export function commonGitDirectory(): string {
  const run = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });

  if (run.status !== 0) {
    throw new Error(`the fixture could not read the common git directory: ${run.stderr}`);
  }

  return run.stdout.trim();
}

export function unrelatedRepository(prefix: string): string {
  const root = scratchDirectory(prefix);
  const start = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });

  if (start.status !== 0) {
    throw new Error(`the fixture repository at ${root} was not created: ${start.stderr}`);
  }

  return root;
}

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

type ConfiguredHook = {
  readonly command: string;
  readonly args: readonly string[] | undefined;
};

function hookNamesTarget(candidate: unknown, marker: string): boolean {
  const command = readProperty(candidate, 'command');
  const launcher = typeof command === 'string' ? [command] : [];

  return [...launcher, ...readStrings(readProperty(candidate, 'args'))].some((piece) =>
    piece.includes(marker),
  );
}

function matchedHooks(event: string, matcher: string): readonly unknown[] {
  const settings: unknown = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, '.claude', 'settings.json'), 'utf8'),
  );

  return readList(readProperty(readProperty(settings, 'hooks'), event)).flatMap((entry) =>
    readProperty(entry, 'matcher') === matcher ? readList(readProperty(entry, 'hooks')) : [],
  );
}

export function configuredHook(event: string, matcher: string, marker: string): ConfiguredHook {
  const hook = matchedHooks(event, matcher).find((candidate) => hookNamesTarget(candidate, marker));
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

export function runHook(
  hook: ConfiguredHook,
  workingDirectory: string,
  payload: string,
): HookOutcome {
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

export function outcomeForPath(editedPath: string, workingDirectory: string): HookOutcome {
  return runHook(
    configuredHook('PostToolUse', EDITING_TOOL_MATCHER, FORMAT_SCRIPT_NAME),
    workingDirectory,
    JSON.stringify({ tool_input: { file_path: editedPath } }),
  );
}

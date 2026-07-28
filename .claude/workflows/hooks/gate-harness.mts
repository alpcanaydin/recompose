import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';

export type HookOutcome = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
};

export const SESSION_TRANSCRIPT = '/claude-projects/example-project/session-0001.jsonl';

const SESSION_WORKING_DIRECTORY = '/example-project';

export const MAIN_LOOP_PATH = 'apps/desktop/src/main/index.ts';

export const MAIN_LOOP_NOTEBOOK_PATH = 'apps/desktop/src/main/index.ipynb';

export const EDITED_CONTENT = 'export const start = (): void => undefined;\n';

export const EDITED_CELL_SOURCE = 'start()\n';

export const GATE_CONFIGURATION = 'export default { rules: [] };\n';

export const GATE_CONFIGURATION_NAME = 'probity.config.ts';

export const GATE_ARGUMENT_ECHO = 'for argument in "$@"; do echo "$argument"; done';

export const DENIAL_DECISION = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'the edit adds behavior that no failing test asked for',
  },
});

const TYPE_STRIPPING_IS_EXPECTED = '--disable-warning=ExperimentalWarning';

const HOOKS_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const HOOKS_PATH_IN_CHECKOUT = join('.claude', 'workflows', 'hooks');

const RESOLVER_SCRIPT_NAME = 'resolve-transcript.mts';

const RESOLVER_MODULE_NAMES: readonly string[] = [RESOLVER_SCRIPT_NAME, 'entry-point.mjs'];

const RESOLVER_PATH_IN_CHECKOUT = join(HOOKS_PATH_IN_CHECKOUT, RESOLVER_SCRIPT_NAME);

const scratchWorkspaces: string[] = [];

after(() => {
  for (const workspace of scratchWorkspaces) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

export function scratchWorkspace(): string {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'transcript-resolver-')));

  scratchWorkspaces.push(workspace);

  return workspace;
}

const AUTHORED_BY_THE_FIXTURE: readonly string[] = [
  '-c',
  'user.email=fixture@example.invalid',
  '-c',
  'user.name=fixture',
];

function runGit(workingDirectory: string, args: readonly string[]): void {
  const run = spawnSync('git', [...args], { cwd: workingDirectory, encoding: 'utf8' });

  if (run.status !== 0) {
    throw new Error(`the fixture could not run git ${args.join(' ')}: ${run.stderr}`);
  }
}

export function checkoutWithResolver(): string {
  const checkout = scratchWorkspace();
  const hooks = join(checkout, HOOKS_PATH_IN_CHECKOUT);

  mkdirSync(hooks, { recursive: true });

  for (const moduleName of RESOLVER_MODULE_NAMES) {
    copyFileSync(join(HOOKS_DIRECTORY, moduleName), join(hooks, moduleName));
  }

  runGit(checkout, ['init', '-q']);
  runGit(checkout, [...AUTHORED_BY_THE_FIXTURE, 'commit', '-q', '--allow-empty', '-m', 'fixture']);

  return checkout;
}

export function checkoutWithStandInGate(gateBody: string): string {
  const checkout = checkoutWithResolver();
  const binDirectory = join(checkout, 'node_modules', '.bin');

  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(join(binDirectory, 'probity'), `#!/bin/sh\ncat >stdin.json\n${gateBody}\n`, {
    mode: 0o755,
  });

  return checkout;
}

export function aliasedCheckout(checkout: string): string {
  const alias = join(scratchWorkspace(), 'aliased-checkout');

  symlinkSync(checkout, alias, 'dir');

  return alias;
}

function worktreeOfCheckout(checkout: string, root: string): string {
  runGit(checkout, ['worktree', 'add', '--no-checkout', '--detach', root]);

  return root;
}

export function configuredWorktreeOfCheckout(checkout: string, root: string): string {
  writeFileSync(
    join(worktreeOfCheckout(checkout, root), GATE_CONFIGURATION_NAME),
    GATE_CONFIGURATION,
    'utf8',
  );

  return root;
}

export function directoryClaimingCheckout(checkout: string, root: string): string {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, '.git'), `gitdir: ${join(checkout, '.git')}\n`, 'utf8');
  writeFileSync(join(root, GATE_CONFIGURATION_NAME), GATE_CONFIGURATION, 'utf8');

  return root;
}

export function plantedRepository(root: string): string {
  mkdirSync(root, { recursive: true });
  runGit(root, ['init', '-q']);
  writeFileSync(join(root, GATE_CONFIGURATION_NAME), GATE_CONFIGURATION, 'utf8');

  return root;
}

export function plantEditTarget(checkout: string, path: string): void {
  const target = join(checkout, path);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, '', 'utf8');
}

export function editPayloadFromWorkingDirectory(
  workingDirectory: string,
  filePath: string,
): string {
  return JSON.stringify({
    session_id: 'session-0001',
    transcript_path: SESSION_TRANSCRIPT,
    cwd: workingDirectory,
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: EDITED_CONTENT },
  });
}

export function notebookPayloadFromWorkingDirectory(
  workingDirectory: string,
  notebookPath: string,
): string {
  return JSON.stringify({
    session_id: 'session-0001',
    transcript_path: SESSION_TRANSCRIPT,
    cwd: workingDirectory,
    tool_name: 'NotebookEdit',
    tool_input: { notebook_path: notebookPath, new_source: EDITED_CELL_SOURCE },
  });
}

export function editPayload(filePath: string): string {
  return editPayloadFromWorkingDirectory(SESSION_WORKING_DIRECTORY, filePath);
}

export function mainLoopPayload(): string {
  return editPayload(MAIN_LOOP_PATH);
}

export function runHookScript(
  script: string,
  workingDirectory: string,
  payload: string,
): HookOutcome {
  const run = spawnSync(process.execPath, [TYPE_STRIPPING_IS_EXPECTED, script], {
    cwd: workingDirectory,
    encoding: 'utf8',
    input: payload,
  });

  if (run.status === null) {
    throw new Error(`${script} was killed by ${String(run.signal)} before it reported`);
  }

  return { stdout: run.stdout, stderr: run.stderr, status: run.status };
}

export function runResolver(
  checkout: string,
  workingDirectory: string,
  payload: string,
): HookOutcome {
  return runHookScript(join(checkout, RESOLVER_PATH_IN_CHECKOUT), workingDirectory, payload);
}

export function runResolverIn(checkout: string, payload: string): HookOutcome {
  return runResolver(checkout, checkout, payload);
}

export function runResolverOutside(checkout: string, payload: string): HookOutcome {
  return runResolver(checkout, scratchWorkspace(), payload);
}

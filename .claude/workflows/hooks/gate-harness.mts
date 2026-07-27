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

const RESOLVER_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'resolve-transcript.mts');

const RESOLVER_PATH_IN_CHECKOUT = join('.claude', 'workflows', 'hooks', 'resolve-transcript.mts');

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

export function checkoutWithResolver(): string {
  const checkout = scratchWorkspace();
  const resolver = join(checkout, RESOLVER_PATH_IN_CHECKOUT);

  mkdirSync(dirname(resolver), { recursive: true });
  copyFileSync(RESOLVER_SCRIPT, resolver);

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

export function bareWorktree(root: string): string {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, GATE_CONFIGURATION_NAME), GATE_CONFIGURATION, 'utf8');

  return root;
}

export function editPayload(filePath: string): string {
  return JSON.stringify({
    session_id: 'session-0001',
    transcript_path: SESSION_TRANSCRIPT,
    tool_name: 'Write',
    tool_input: { file_path: filePath },
  });
}

export function mainLoopPayload(): string {
  return editPayload('apps/desktop/src/main/index.ts');
}

export function runResolver(
  checkout: string,
  workingDirectory: string,
  payload: string,
): HookOutcome {
  const run = spawnSync(process.execPath, [join(checkout, RESOLVER_PATH_IN_CHECKOUT)], {
    cwd: workingDirectory,
    encoding: 'utf8',
    input: payload,
  });

  if (run.status === null) {
    throw new Error(`the resolver was killed by ${String(run.signal)} before it reported`);
  }

  return { stdout: run.stdout, stderr: run.stderr, status: run.status };
}

export function runResolverIn(checkout: string, payload: string): HookOutcome {
  return runResolver(checkout, checkout, payload);
}

export function runResolverOutside(checkout: string, payload: string): HookOutcome {
  return runResolver(checkout, scratchWorkspace(), payload);
}

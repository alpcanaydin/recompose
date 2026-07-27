import assert from 'node:assert/strict';
import { copyFileSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DENIAL_DECISION,
  type HookOutcome,
  mainLoopPayload,
  runHookScript,
  scratchWorkspace,
} from './gate-harness.mts';
import { NODE_FLOOR } from './launch-gate.mjs';

const HOOKS_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const REPOSITORY_ROOT = join(HOOKS_DIRECTORY, '..', '..', '..');

const LAUNCHER_SCRIPT_NAME = 'launch-gate.mjs';

const RESOLVER_SCRIPT_NAME = 'resolve-transcript.mts';

const TYPE_STRIPPING_FAILURE = 'throw new Error(\'Unknown file extension ".mts"\');\n';

const DENYING_RESOLVER = 'process.exit(2);\n';

const PERMITTING_RESOLVER = `process.stdout.write('${DENIAL_DECISION}');\n`;

function launcherWithStandInResolver(resolverBody: string): string {
  const workspace = scratchWorkspace();

  copyFileSync(join(HOOKS_DIRECTORY, LAUNCHER_SCRIPT_NAME), join(workspace, LAUNCHER_SCRIPT_NAME));
  writeFileSync(join(workspace, RESOLVER_SCRIPT_NAME), resolverBody, 'utf8');

  return workspace;
}

function runLauncher(workspace: string, launcherDirectory = workspace): HookOutcome {
  return runHookScript(join(launcherDirectory, LAUNCHER_SCRIPT_NAME), workspace, mainLoopPayload());
}

function readProperty(value: unknown, property: string): unknown {
  return typeof value === 'object' && value !== null && property in value
    ? Reflect.get(value, property)
    : undefined;
}

function declaredNodeRange(): unknown {
  const manifest: unknown = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8'));

  return readProperty(readProperty(manifest, 'engines'), 'node');
}

describe('the test-first gate launcher: a node that cannot load the resolver', () => {
  it('denies the tool call and names the node range the gate needs', () => {
    const outcome = runLauncher(launcherWithStandInResolver(TYPE_STRIPPING_FAILURE));

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /the test-first gate never ran/);
    assert.ok(outcome.stderr.includes(NODE_FLOOR));
  });
});

describe('the test-first gate launcher: a resolver that denies the tool call', () => {
  it('hands the caller that denial unchanged', () => {
    const outcome = runLauncher(launcherWithStandInResolver(DENYING_RESOLVER));

    assert.equal(outcome.status, 2);
    assert.equal(outcome.stderr, '');
  });
});

describe('the test-first gate launcher: a resolver that reports a gate decision', () => {
  it('hands the caller that decision and exit status unchanged', () => {
    const outcome = runLauncher(launcherWithStandInResolver(PERMITTING_RESOLVER));

    assert.equal(outcome.stdout, DENIAL_DECISION);
    assert.equal(outcome.status, 0);
  });
});

describe('the test-first gate launcher: a launcher reached through a symlinked parent', () => {
  it('still runs the resolver rather than exiting quietly', () => {
    const workspace = launcherWithStandInResolver(PERMITTING_RESOLVER);
    const alias = join(scratchWorkspace(), 'aliased-hooks');

    symlinkSync(workspace, alias, 'dir');

    const outcome = runLauncher(workspace, alias);

    assert.equal(outcome.stdout, DENIAL_DECISION);
    assert.equal(outcome.status, 0);
  });
});

describe('the test-first gate launcher: the node range it names', () => {
  it('matches the engines range the package manifest declares', () => {
    assert.equal(NODE_FLOOR, declaredNodeRange());
  });
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { scratchWorkspace } from './gate-harness.mts';

const HOOKS_DIRECTORY = dirname(fileURLToPath(import.meta.url));

const GUARD_MODULE_SPECIFIER = pathToFileURL(join(HOOKS_DIRECTORY, 'entry-point.mjs')).href;

const REPORTER_NAME = 'reporter.mjs';

const LAUNCHER_NAME = 'launcher.mjs';

const REPORTER_BODY = `import { isProcessEntryPoint } from ${JSON.stringify(GUARD_MODULE_SPECIFIER)};

process.stdout.write(String(isProcessEntryPoint(import.meta.url)));
`;

type WorkflowEntry = {
  readonly name: string;
  readonly path: string;
};

const WORKFLOW_ENTRIES: readonly WorkflowEntry[] = [
  { name: 'the gate launcher', path: join(HOOKS_DIRECTORY, 'launch-gate.mjs') },
  { name: 'the transcript resolver', path: join(HOOKS_DIRECTORY, 'resolve-transcript.mts') },
  {
    name: 'the blast-radius path guard',
    path: join(HOOKS_DIRECTORY, '..', 'path-guard', 'path-guard.mts'),
  },
];

function workspaceWithReporter(): string {
  const workspace = scratchWorkspace();

  writeFileSync(join(workspace, REPORTER_NAME), REPORTER_BODY, 'utf8');

  return workspace;
}

function launch(modulePath: string): string {
  const run = spawnSync(process.execPath, [modulePath], { encoding: 'utf8' });

  if (run.status !== 0) {
    throw new Error(`${modulePath} did not report a decision: ${run.stderr}`);
  }

  return run.stdout;
}

describe('the workflow entry guard: a module launched as the process entry', () => {
  it('reports that module as the entry', () => {
    assert.equal(launch(join(workspaceWithReporter(), REPORTER_NAME)), 'true');
  });
});

describe('the workflow entry guard: a module launched through a symlinked parent', () => {
  it('still reports that module as the entry', () => {
    const workspace = workspaceWithReporter();
    const alias = join(scratchWorkspace(), 'aliased-modules');

    symlinkSync(workspace, alias, 'dir');

    assert.equal(launch(join(alias, REPORTER_NAME)), 'true');
  });
});

describe('the workflow entry guard: a module the process entry merely imports', () => {
  it('reports that module as no entry, so an imported module stays quiet', () => {
    const workspace = workspaceWithReporter();

    writeFileSync(join(workspace, LAUNCHER_NAME), `import './${REPORTER_NAME}';\n`, 'utf8');

    assert.equal(launch(join(workspace, LAUNCHER_NAME)), 'false');
  });
});

describe('the workflow entries: how each decides it is the process entry', () => {
  for (const entry of WORKFLOW_ENTRIES) {
    it(`${entry.name} decides through the shared guard alone`, () => {
      const source = readFileSync(entry.path, 'utf8');

      assert.match(source, /isProcessEntryPoint/);
      assert.doesNotMatch(source, /import\.meta\.main/);
    });
  }
});

import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';

import { gateConfigurationPath, resolveTranscriptPath } from './resolve-transcript.mts';

const SESSION_TRANSCRIPT = '/claude-projects/example-project/session-0001.jsonl';

const CHECKOUT_ROOT = '/workspace/recompose';

const CHECKOUT_CONFIGURATION = '/workspace/recompose/probity.config.ts';

const SIBLING_WORKTREE_CONFIGURATION = '/workspace/cluster-1/probity.config.ts';

const NESTED_WORKTREE_CONFIGURATION =
  '/workspace/recompose/.claude/worktrees/cluster-1/probity.config.ts';

const noConfigurationExists = (): boolean => false;

const OUTSIDE_THE_REPOSITORY: readonly string[] = [];

function ancestorsWithin(root: string): (start: string) => readonly string[] {
  return (start) => {
    const reachable = [start];
    let directory = start;

    while (directory !== root && directory.startsWith(`${root}/`)) {
      directory = dirname(directory);
      reachable.push(directory);
    }

    return directory === root ? reachable : OUTSIDE_THE_REPOSITORY;
  };
}

const withinTheCheckout = ancestorsWithin(CHECKOUT_ROOT);

const withinTheSiblingWorktree = ancestorsWithin('/workspace/cluster-1');

const withinTheNestedWorktree = ancestorsWithin('/workspace/recompose/.claude/worktrees/cluster-1');

const outsideEveryWorktree = (): readonly string[] => OUTSIDE_THE_REPOSITORY;

const SUBAGENT_ID = 'a1b2c3d4e5f6';

const SUBAGENT_RECORD =
  '/claude-projects/example-project/session-0001/subagents/agent-a1b2c3d4e5f6.jsonl';

const WORKFLOW_DIRECTORY = 'wf_9c2aa127-a1f';

const WORKFLOW_SUBAGENT_RECORD =
  '/claude-projects/example-project/session-0001/subagents/workflows/wf_9c2aa127-a1f/agent-a1b2c3d4e5f6.jsonl';

const noWorkflowRan = { recordExists: () => false, listWorkflows: () => [] };

const oneWorkflowRan = (recordExists: (path: string) => boolean) => ({
  recordExists,
  listWorkflows: () => [WORKFLOW_DIRECTORY],
});

describe('transcript resolution: a payload naming no subagent', () => {
  it('hands the gate the session transcript', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT },
      {
        recordExists: () => true,
        listWorkflows: () => [WORKFLOW_DIRECTORY],
      },
    );

    assert.equal(resolved, SESSION_TRANSCRIPT);
  });
});

describe('transcript resolution: a subagent the Task tool dispatched', () => {
  it('hands the gate that subagent record', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT, agent_id: SUBAGENT_ID },
      oneWorkflowRan((path) => path === SUBAGENT_RECORD),
    );

    assert.equal(resolved, SUBAGENT_RECORD);
  });
});

describe('transcript resolution: a subagent a saved workflow dispatched', () => {
  it('hands the gate the record nested under that workflow', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT, agent_id: SUBAGENT_ID },
      oneWorkflowRan((path) => path === WORKFLOW_SUBAGENT_RECORD),
    );

    assert.equal(resolved, WORKFLOW_SUBAGENT_RECORD);
  });
});

describe('transcript resolution: a payload naming a subagent with no record on disk', () => {
  it('falls back to the session transcript', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT, agent_id: SUBAGENT_ID },
      noWorkflowRan,
    );

    assert.equal(resolved, SESSION_TRANSCRIPT);
  });
});

describe('gate scope: an edit inside a worktree beside the checkout', () => {
  it('names that worktree own gate configuration', () => {
    const configuration = gateConfigurationPath(
      '/workspace/cluster-1/apps/desktop/src/main/index.ts',
      CHECKOUT_ROOT,
      (path) => path === SIBLING_WORKTREE_CONFIGURATION,
      withinTheSiblingWorktree,
    );

    assert.equal(configuration, SIBLING_WORKTREE_CONFIGURATION);
  });
});

describe('gate scope: an edit inside a worktree nested under the checkout', () => {
  it('names the nearest gate configuration rather than the checkout one', () => {
    const configuration = gateConfigurationPath(
      '/workspace/recompose/.claude/worktrees/cluster-1/packages/contracts/src/ipc.ts',
      CHECKOUT_ROOT,
      (path) => path === NESTED_WORKTREE_CONFIGURATION || path === CHECKOUT_CONFIGURATION,
      withinTheNestedWorktree,
    );

    assert.equal(configuration, NESTED_WORKTREE_CONFIGURATION);
  });
});

describe('gate scope: an edit no gate configuration covers', () => {
  it('falls back to the checkout that owns the resolver', () => {
    const configuration = gateConfigurationPath(
      '/elsewhere/notes/scratch.ts',
      CHECKOUT_ROOT,
      noConfigurationExists,
      outsideEveryWorktree,
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

describe('gate scope: an edit beside a gate configuration outside every worktree', () => {
  it('refuses that configuration and keeps the checkout that owns the resolver', () => {
    const configuration = gateConfigurationPath(
      '/tmp/planted/index.ts',
      CHECKOUT_ROOT,
      (path) => path === '/tmp/planted/probity.config.ts',
      outsideEveryWorktree,
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

describe('gate scope: an edit under a gate configuration above the worktree root', () => {
  it('stops climbing at the worktree root rather than reaching that configuration', () => {
    const configuration = gateConfigurationPath(
      '/workspace/cluster-1/apps/desktop/src/main/index.ts',
      CHECKOUT_ROOT,
      (path) => path === '/workspace/probity.config.ts',
      withinTheSiblingWorktree,
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

describe('gate scope: a payload naming no edited file', () => {
  it('falls back to the checkout that owns the resolver', () => {
    const configuration = gateConfigurationPath(
      undefined,
      CHECKOUT_ROOT,
      noConfigurationExists,
      outsideEveryWorktree,
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

describe('gate scope: a payload naming the edited file relative to the checkout', () => {
  it('reads that path against the checkout that owns the resolver', () => {
    const configuration = gateConfigurationPath(
      'apps/desktop/src/main/index.ts',
      CHECKOUT_ROOT,
      (path) => path === CHECKOUT_CONFIGURATION,
      withinTheCheckout,
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

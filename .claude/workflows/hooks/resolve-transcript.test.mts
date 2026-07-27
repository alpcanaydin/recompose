import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gateConfigurationPath, resolveTranscriptPath } from './resolve-transcript.mts';

const SESSION_TRANSCRIPT = '/claude-projects/example-project/session-0001.jsonl';

const CHECKOUT_ROOT = '/workspace/recompose';

const CHECKOUT_CONFIGURATION = '/workspace/recompose/probity.config.ts';

const SIBLING_WORKTREE_CONFIGURATION = '/workspace/cluster-1/probity.config.ts';

const NESTED_WORKTREE_CONFIGURATION =
  '/workspace/recompose/.claude/worktrees/cluster-1/probity.config.ts';

const noConfigurationExists = (): boolean => false;

const SUBAGENT_ID = 'a1b2c3d4e5f6';

const SUBAGENT_RECORD =
  '/claude-projects/example-project/session-0001/subagents/agent-a1b2c3d4e5f6.jsonl';

const everyRecordExists = (): boolean => true;

const noRecordExists = (): boolean => false;

describe('transcript resolution: a payload naming no subagent', () => {
  it('hands the gate the session transcript', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT },
      everyRecordExists,
    );

    assert.equal(resolved, SESSION_TRANSCRIPT);
  });
});

describe('transcript resolution: a payload naming a subagent that kept its own record', () => {
  it('hands the gate that subagent record', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT, agent_id: SUBAGENT_ID },
      (path) => path === SUBAGENT_RECORD,
    );

    assert.equal(resolved, SUBAGENT_RECORD);
  });
});

describe('transcript resolution: a payload naming a subagent with no record on disk', () => {
  it('falls back to the session transcript', () => {
    const resolved = resolveTranscriptPath(
      { transcript_path: SESSION_TRANSCRIPT, agent_id: SUBAGENT_ID },
      noRecordExists,
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
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

describe('gate scope: a payload naming no edited file', () => {
  it('falls back to the checkout that owns the resolver', () => {
    const configuration = gateConfigurationPath(undefined, CHECKOUT_ROOT, noConfigurationExists);

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

describe('gate scope: a payload naming the edited file relative to the checkout', () => {
  it('reads that path against the checkout that owns the resolver', () => {
    const configuration = gateConfigurationPath(
      'apps/desktop/src/main/index.ts',
      CHECKOUT_ROOT,
      (path) => path === CHECKOUT_CONFIGURATION,
    );

    assert.equal(configuration, CHECKOUT_CONFIGURATION);
  });
});

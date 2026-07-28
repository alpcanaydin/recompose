import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveTranscriptPath } from './resolve-transcript.mts';

const SESSION_TRANSCRIPT = '/claude-projects/example-project/session-0001.jsonl';

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

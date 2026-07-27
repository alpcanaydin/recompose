import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveTranscriptPath } from './resolve-transcript.mts';

const SESSION_TRANSCRIPT = '/claude-projects/example-project/session-0001.jsonl';

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

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import {
  aliasedCheckout,
  checkoutWithStandInGate,
  EDITED_CELL_SOURCE,
  EDITED_CONTENT,
  editPayloadFromWorkingDirectory,
  EDITING_SUBAGENT_ID,
  MAIN_LOOP_NOTEBOOK_PATH,
  MAIN_LOOP_PATH,
  notebookPayloadFromWorkingDirectory,
  plantEditTarget,
  REPLACED_CONTENT,
  replacementPayloadFromWorkingDirectory,
  runResolverIn,
  scratchWorkspace,
  SESSION_TRANSCRIPT,
  subagentPayloadFromWorkingDirectory,
} from './gate-harness.mts';

const WORKING_DIRECTORY_IN_CHECKOUT = join('apps', 'desktop');

const PATH_BELOW_THAT_WORKING_DIRECTORY = join('src', 'main', 'index.ts');

const NOTEBOOK_BELOW_THAT_WORKING_DIRECTORY = join('src', 'main', 'index.ipynb');

const SESSION_TRANSCRIPT_IN_CHECKOUT = join('transcripts', 'session-0001.jsonl');

const SUBAGENT_RECORD_IN_CHECKOUT = join(
  'transcripts',
  'session-0001',
  'subagents',
  `agent-${EDITING_SUBAGENT_ID}.jsonl`,
);

describe('the test-first gate action path: an edit reached through a symbolic link', () => {
  it('hands the gate the path the payload names rather than the path it resolves to', () => {
    const checkout = checkoutWithStandInGate('cat stdin.json');
    const alias = aliasedCheckout(checkout);
    const editedFile = join(alias, MAIN_LOOP_PATH);

    plantEditTarget(checkout, MAIN_LOOP_PATH);

    const outcome = runResolverIn(alias, editPayloadFromWorkingDirectory(alias, editedFile));

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: SESSION_TRANSCRIPT,
      cwd: alias,
      tool_name: 'Write',
      tool_input: { file_path: editedFile, content: EDITED_CONTENT },
    });
  });
});

describe('the test-first gate action path: an edit left relative to its working directory', () => {
  it('hands the gate that relative path rather than an anchored one', () => {
    const checkout = checkoutWithStandInGate('cat stdin.json');
    const workingDirectory = join(checkout, WORKING_DIRECTORY_IN_CHECKOUT);

    plantEditTarget(checkout, MAIN_LOOP_PATH);

    const outcome = runResolverIn(
      checkout,
      editPayloadFromWorkingDirectory(workingDirectory, PATH_BELOW_THAT_WORKING_DIRECTORY),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: SESSION_TRANSCRIPT,
      cwd: workingDirectory,
      tool_name: 'Write',
      tool_input: { file_path: PATH_BELOW_THAT_WORKING_DIRECTORY, content: EDITED_CONTENT },
    });
  });
});

describe('the test-first gate action path: a notebook edit reached through a symbolic link', () => {
  it('hands the gate the path the payload names rather than the path it resolves to', () => {
    const checkout = checkoutWithStandInGate('cat stdin.json');
    const alias = aliasedCheckout(checkout);
    const editedNotebook = join(alias, MAIN_LOOP_NOTEBOOK_PATH);

    plantEditTarget(checkout, MAIN_LOOP_NOTEBOOK_PATH);

    const outcome = runResolverIn(
      alias,
      notebookPayloadFromWorkingDirectory(alias, editedNotebook),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: SESSION_TRANSCRIPT,
      cwd: alias,
      tool_name: 'NotebookEdit',
      tool_input: { notebook_path: editedNotebook, new_source: EDITED_CELL_SOURCE },
    });
  });
});

describe('the test-first gate action path: a notebook edit left relative to its working directory', () => {
  it('hands the gate that relative path rather than an anchored one', () => {
    const checkout = checkoutWithStandInGate('cat stdin.json');
    const workingDirectory = join(checkout, WORKING_DIRECTORY_IN_CHECKOUT);

    plantEditTarget(checkout, MAIN_LOOP_NOTEBOOK_PATH);

    const outcome = runResolverIn(
      checkout,
      notebookPayloadFromWorkingDirectory(workingDirectory, NOTEBOOK_BELOW_THAT_WORKING_DIRECTORY),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: SESSION_TRANSCRIPT,
      cwd: workingDirectory,
      tool_name: 'NotebookEdit',
      tool_input: {
        notebook_path: NOTEBOOK_BELOW_THAT_WORKING_DIRECTORY,
        new_source: EDITED_CELL_SOURCE,
      },
    });
  });
});

describe('the test-first gate action path: a replacement edit reached through a symbolic link', () => {
  it('hands the gate the path the payload names rather than the path it resolves to', () => {
    const checkout = checkoutWithStandInGate('cat stdin.json');
    const alias = aliasedCheckout(checkout);
    const editedFile = join(alias, MAIN_LOOP_PATH);

    plantEditTarget(checkout, MAIN_LOOP_PATH);

    const outcome = runResolverIn(alias, replacementPayloadFromWorkingDirectory(alias, editedFile));

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: SESSION_TRANSCRIPT,
      cwd: alias,
      tool_name: 'Edit',
      tool_input: {
        file_path: editedFile,
        old_string: REPLACED_CONTENT,
        new_string: EDITED_CONTENT,
      },
    });
  });
});

describe('the test-first gate action path: an edit a subagent names in full', () => {
  it('hands the gate that path rather than the one it resolves to, beside the subagent record', () => {
    const checkout = checkoutWithStandInGate('cat stdin.json');
    const alias = aliasedCheckout(checkout);
    const editedFile = join(alias, MAIN_LOOP_PATH);
    const sessionTranscript = join(checkout, SESSION_TRANSCRIPT_IN_CHECKOUT);
    const subagentRecord = join(checkout, SUBAGENT_RECORD_IN_CHECKOUT);

    mkdirSync(dirname(subagentRecord), { recursive: true });
    writeFileSync(sessionTranscript, '', 'utf8');
    writeFileSync(subagentRecord, '', 'utf8');
    plantEditTarget(checkout, MAIN_LOOP_PATH);

    const outcome = runResolverIn(
      alias,
      subagentPayloadFromWorkingDirectory(alias, editedFile, sessionTranscript),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: subagentRecord,
      agent_id: EDITING_SUBAGENT_ID,
      agent_type: 'tdd-implementer',
      cwd: alias,
      tool_name: 'Write',
      tool_input: { file_path: editedFile, content: EDITED_CONTENT },
    });
  });
});

describe('the test-first gate action path: the target the cases above plant', () => {
  it('carries the text a replacement payload names, so the vendor accepts that edit', () => {
    const checkout = scratchWorkspace();

    plantEditTarget(checkout, MAIN_LOOP_PATH);

    assert.equal(readFileSync(join(checkout, MAIN_LOOP_PATH), 'utf8'), REPLACED_CONTENT);
  });
});

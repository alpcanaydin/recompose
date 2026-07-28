import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import {
  aliasedCheckout,
  checkoutWithResolver,
  checkoutWithStandInGate,
  DENIAL_DECISION,
  GATE_CONFIGURATION,
  mainLoopPayload,
  runResolverIn,
  runResolverOutside,
} from './gate-harness.mts';

const SUBAGENT_ID = 'a1b2c3d4e5f6';

const GATE_DIAGNOSTIC = 'Probity: the configuration named an unknown rule\n';

function subagentPayload(transcriptPath: string): string {
  return JSON.stringify({
    session_id: 'session-0001',
    transcript_path: transcriptPath,
    agent_id: SUBAGENT_ID,
    agent_type: 'tdd-implementer',
    tool_name: 'Write',
  });
}

describe('the test-first gate pipe: a gate that denies on standard output', () => {
  it('hands the caller that decision unchanged', () => {
    const workspace = checkoutWithStandInGate('cat decision.json');

    writeFileSync(join(workspace, 'decision.json'), DENIAL_DECISION, 'utf8');

    const outcome = runResolverIn(workspace, mainLoopPayload());

    assert.equal(outcome.stdout, DENIAL_DECISION);
  });
});

describe('the test-first gate pipe: a gate that writes a diagnostic to standard error', () => {
  it('hands the caller that diagnostic unchanged', () => {
    const workspace = checkoutWithStandInGate('cat diagnostic.txt >&2');

    writeFileSync(join(workspace, 'diagnostic.txt'), GATE_DIAGNOSTIC, 'utf8');

    const outcome = runResolverIn(workspace, mainLoopPayload());

    assert.equal(outcome.stderr, GATE_DIAGNOSTIC);
  });
});

describe('the test-first gate pipe: a gate that exits non-zero', () => {
  it('hands the caller that exit status unchanged', () => {
    const outcome = runResolverIn(checkoutWithStandInGate('exit 17'), mainLoopPayload());

    assert.equal(outcome.status, 17);
  });
});

describe('the test-first gate pipe: a subagent call whose own record exists', () => {
  it('hands the gate a payload naming that record and nothing else changed', () => {
    const workspace = checkoutWithStandInGate('cat stdin.json');
    const sessionTranscript = join(workspace, 'transcripts', 'session-0001.jsonl');
    const subagentRecord = join(
      workspace,
      'transcripts',
      'session-0001',
      'subagents',
      `agent-${SUBAGENT_ID}.jsonl`,
    );

    mkdirSync(dirname(subagentRecord), { recursive: true });
    writeFileSync(sessionTranscript, '', 'utf8');
    writeFileSync(subagentRecord, '', 'utf8');

    const outcome = runResolverIn(workspace, subagentPayload(sessionTranscript));

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: subagentRecord,
      agent_id: SUBAGENT_ID,
      agent_type: 'tdd-implementer',
      tool_name: 'Write',
    });
  });
});

describe('the test-first gate pipe: a subagent a saved workflow dispatched', () => {
  it('hands the gate the record nested under that workflow', () => {
    const workspace = checkoutWithStandInGate('cat stdin.json');
    const sessionTranscript = join(workspace, 'transcripts', 'session-0001.jsonl');
    const workflowRecord = join(
      workspace,
      'transcripts',
      'session-0001',
      'subagents',
      'workflows',
      'wf_9c2aa127-a1f',
      `agent-${SUBAGENT_ID}.jsonl`,
    );

    mkdirSync(dirname(workflowRecord), { recursive: true });
    writeFileSync(sessionTranscript, '', 'utf8');
    writeFileSync(workflowRecord, '', 'utf8');

    const outcome = runResolverIn(workspace, subagentPayload(sessionTranscript));

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: workflowRecord,
      agent_id: SUBAGENT_ID,
      agent_type: 'tdd-implementer',
      tool_name: 'Write',
    });
    assert.equal(outcome.stderr, '');
  });
});

describe('the test-first gate pipe: a subagent call whose own record is missing', () => {
  it('announces which record was sought and which one the gate read instead', () => {
    const workspace = checkoutWithStandInGate('cat stdin.json');
    const sessionTranscript = join(workspace, 'transcripts', 'session-0001.jsonl');
    const soughtRecord = join(
      workspace,
      'transcripts',
      'session-0001',
      'subagents',
      `agent-${SUBAGENT_ID}.jsonl`,
    );

    mkdirSync(dirname(sessionTranscript), { recursive: true });
    writeFileSync(sessionTranscript, '', 'utf8');

    const outcome = runResolverIn(workspace, subagentPayload(sessionTranscript));

    assert.equal(
      outcome.stderr,
      `the subagent record ${soughtRecord} is missing, so the test-first gate reads the session transcript ${sessionTranscript} instead\n`,
    );
    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: sessionTranscript,
      agent_id: SUBAGENT_ID,
      agent_type: 'tdd-implementer',
      tool_name: 'Write',
    });
    assert.equal(outcome.status, 0);
  });
});

describe('the test-first gate pipe: a payload naming the file the tool call would edit', () => {
  it('hands the gate that path exactly as the payload named it', () => {
    const workspace = checkoutWithStandInGate('cat stdin.json');
    const payload = mainLoopPayload();

    const outcome = runResolverIn(workspace, payload);

    assert.deepEqual(JSON.parse(outcome.stdout), JSON.parse(payload));
  });
});

describe('the test-first gate pipe: a payload naming no subagent', () => {
  it('leaves standard error clean', () => {
    const outcome = runResolverIn(checkoutWithStandInGate('exit 0'), mainLoopPayload());

    assert.equal(outcome.stderr, '');
  });
});

describe('the test-first gate pipe: a payload the resolver cannot parse', () => {
  it('denies the tool call and reports that the gate never ran', () => {
    const outcome = runResolverIn(checkoutWithStandInGate('exit 0'), 'not a hook payload');

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /the test-first gate never ran/);
  });
});

describe('the test-first gate pipe: a checkout with no gate binary installed', () => {
  it('denies the tool call and names the binary that did not start', () => {
    const outcome = runResolverIn(checkoutWithResolver(), mainLoopPayload());

    assert.equal(outcome.status, 2);
    assert.match(outcome.stderr, /probity did not start/);
  });
});

describe('the test-first gate pipe: a checkout reached through a symlinked parent', () => {
  it('still starts the gate and hands the caller its decision', () => {
    const checkout = checkoutWithStandInGate(`printf '%s' '${DENIAL_DECISION}'`);

    const outcome = runResolverIn(aliasedCheckout(checkout), mainLoopPayload());

    assert.equal(outcome.stdout, DENIAL_DECISION);
    assert.equal(outcome.status, 0);
  });
});

describe('the test-first gate pipe: a hook firing from a working directory outside the checkout', () => {
  it('still starts the gate and hands the caller its decision', () => {
    const checkout = checkoutWithStandInGate(`printf '%s' '${DENIAL_DECISION}'`);

    const outcome = runResolverOutside(checkout, mainLoopPayload());

    assert.equal(outcome.stdout, DENIAL_DECISION);
    assert.equal(outcome.status, 0);
  });

  it('runs the gate inside the checkout that keeps the gate configuration', () => {
    const checkout = checkoutWithStandInGate('cat probity.config.ts');

    writeFileSync(join(checkout, 'probity.config.ts'), GATE_CONFIGURATION, 'utf8');

    const outcome = runResolverOutside(checkout, mainLoopPayload());

    assert.equal(outcome.stdout, GATE_CONFIGURATION);
  });
});

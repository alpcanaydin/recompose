import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SESSION_TRANSCRIPT = '/claude-projects/example-project/session-0001.jsonl';

const SUBAGENT_ID = 'a1b2c3d4e5f6';

const RESOLVER_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'resolve-transcript.mts');

const RESOLVER_PATH_IN_CHECKOUT = join('.claude', 'workflows', 'hooks', 'resolve-transcript.mts');

const GATE_CONFIGURATION = 'export default { rules: [] };\n';

const DENIAL_DECISION = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'the edit adds behavior that no failing test asked for',
  },
});

const GATE_DIAGNOSTIC = 'Probity: the configuration named an unknown rule\n';

type HookOutcome = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
};

const scratchWorkspaces: string[] = [];

after(() => {
  for (const workspace of scratchWorkspaces) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

function scratchWorkspace(): string {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'transcript-resolver-')));

  scratchWorkspaces.push(workspace);

  return workspace;
}

function checkoutWithResolver(): string {
  const checkout = scratchWorkspace();
  const resolver = join(checkout, RESOLVER_PATH_IN_CHECKOUT);

  mkdirSync(dirname(resolver), { recursive: true });
  copyFileSync(RESOLVER_SCRIPT, resolver);

  return checkout;
}

function checkoutWithStandInGate(gateBody: string): string {
  const checkout = checkoutWithResolver();
  const binDirectory = join(checkout, 'node_modules', '.bin');

  mkdirSync(binDirectory, { recursive: true });
  writeFileSync(join(binDirectory, 'probity'), `#!/bin/sh\ncat >stdin.json\n${gateBody}\n`, {
    mode: 0o755,
  });

  return checkout;
}

function mainLoopPayload(): string {
  return JSON.stringify({
    session_id: 'session-0001',
    transcript_path: SESSION_TRANSCRIPT,
    tool_name: 'Write',
    tool_input: { file_path: 'apps/desktop/src/main/index.ts' },
  });
}

function runResolver(checkout: string, workingDirectory: string, payload: string): HookOutcome {
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

function runResolverIn(checkout: string, payload: string): HookOutcome {
  return runResolver(checkout, checkout, payload);
}

function runResolverOutside(checkout: string, payload: string): HookOutcome {
  return runResolver(checkout, scratchWorkspace(), payload);
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

    const outcome = runResolverIn(
      workspace,
      JSON.stringify({
        session_id: 'session-0001',
        transcript_path: sessionTranscript,
        agent_id: SUBAGENT_ID,
        agent_type: 'tdd-implementer',
        tool_name: 'Write',
      }),
    );

    assert.deepEqual(JSON.parse(outcome.stdout), {
      session_id: 'session-0001',
      transcript_path: subagentRecord,
      agent_id: SUBAGENT_ID,
      agent_type: 'tdd-implementer',
      tool_name: 'Write',
    });
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

    const outcome = runResolverIn(
      workspace,
      JSON.stringify({
        session_id: 'session-0001',
        transcript_path: sessionTranscript,
        agent_id: SUBAGENT_ID,
        agent_type: 'tdd-implementer',
        tool_name: 'Write',
      }),
    );

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

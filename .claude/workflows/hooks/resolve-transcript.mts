import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type SubagentAwarePayload = {
  readonly transcript_path: string;
  readonly agent_id?: string | undefined;
};

const GATE_COMMAND = './node_modules/.bin/probity';

const GATE_ARGUMENTS: readonly string[] = ['--agent', 'claude-code'];

const BLOCKING_EXIT_STATUS = 2;

function subagentRecordPath(transcriptPath: string, agentId: string): string {
  const sessionDirectory = transcriptPath.replace(/\.jsonl$/, '');

  return `${sessionDirectory}/subagents/agent-${agentId}.jsonl`;
}

export function resolveTranscriptPath(
  payload: SubagentAwarePayload,
  recordExists: (path: string) => boolean,
): string {
  const agentId = payload.agent_id;

  if (agentId === undefined) {
    return payload.transcript_path;
  }

  const subagentRecord = subagentRecordPath(payload.transcript_path, agentId);

  return recordExists(subagentRecord) ? subagentRecord : payload.transcript_path;
}

function blockToolCall(reason: string): never {
  console.error(`the test-first gate never ran, so the tool call is denied: ${reason}`);
  process.exit(BLOCKING_EXIT_STATUS);
}

function describeFailure(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function readPayloadObject(raw: string): object {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('the payload is not a JSON object');
  }

  return parsed;
}

function readSubagentAwarePayload(payload: object): SubagentAwarePayload {
  const transcriptPath = 'transcript_path' in payload ? payload.transcript_path : undefined;
  const agentId = 'agent_id' in payload ? payload.agent_id : undefined;

  if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) {
    throw new Error('the payload names no transcript path');
  }

  return {
    transcript_path: transcriptPath,
    agent_id: typeof agentId === 'string' ? agentId : undefined,
  };
}

function buildGateInput(): string {
  try {
    const payload = readPayloadObject(readFileSync(0, 'utf8'));
    const transcriptPath = resolveTranscriptPath(readSubagentAwarePayload(payload), existsSync);

    return JSON.stringify({ ...payload, transcript_path: transcriptPath });
  } catch (cause) {
    return blockToolCall(`the PreToolUse payload was unusable: ${describeFailure(cause)}`);
  }
}

function main(): void {
  const run = spawnSync(GATE_COMMAND, GATE_ARGUMENTS, {
    input: buildGateInput(),
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  if (run.error !== undefined) {
    blockToolCall(`${GATE_COMMAND} did not start: ${run.error.message}`);
  }

  if (run.status === null) {
    blockToolCall(`${GATE_COMMAND} was killed by ${String(run.signal)}`);
  }

  process.exit(run.status);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

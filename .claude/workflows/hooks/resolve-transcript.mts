import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type SubagentAwarePayload = {
  readonly transcript_path: string;
  readonly agent_id?: string | undefined;
};

type GateInvocation = {
  readonly payload: string;
  readonly configuration: string;
};

const CHECKOUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const GATE_COMMAND = join(CHECKOUT_ROOT, 'node_modules', '.bin', 'probity');

const GATE_ARGUMENTS: readonly string[] = ['--agent', 'claude-code'];

const GATE_CONFIGURATION_NAME = 'probity.config.ts';

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

function ancestorDirectories(startDirectory: string): readonly string[] {
  const directories = [startDirectory];
  let directory = startDirectory;

  while (dirname(directory) !== directory) {
    directory = dirname(directory);
    directories.push(directory);
  }

  return directories;
}

export function gateConfigurationPath(
  editedPath: string | undefined,
  checkoutRoot: string,
  configurationExists: (path: string) => boolean,
): string {
  const checkoutConfiguration = join(checkoutRoot, GATE_CONFIGURATION_NAME);

  if (editedPath === undefined) {
    return checkoutConfiguration;
  }

  return (
    ancestorDirectories(dirname(resolve(checkoutRoot, editedPath)))
      .map((directory) => join(directory, GATE_CONFIGURATION_NAME))
      .find(configurationExists) ?? checkoutConfiguration
  );
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

function readTranscriptPath(payload: object): string {
  const transcriptPath = 'transcript_path' in payload ? payload.transcript_path : undefined;

  if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) {
    throw new Error('the payload names no transcript path');
  }

  return transcriptPath;
}

function readAgentId(payload: object): string | undefined {
  const agentId = 'agent_id' in payload ? payload.agent_id : undefined;

  return typeof agentId === 'string' ? agentId : undefined;
}

function readSubagentAwarePayload(payload: object): SubagentAwarePayload {
  return {
    transcript_path: readTranscriptPath(payload),
    agent_id: readAgentId(payload),
  };
}

function announceMissingSubagentRecord(payload: SubagentAwarePayload, resolved: string): void {
  const agentId = payload.agent_id;

  if (agentId === undefined || resolved !== payload.transcript_path) {
    return;
  }

  const soughtRecord = subagentRecordPath(payload.transcript_path, agentId);

  console.error(
    `the subagent record ${soughtRecord} is missing, so the test-first gate reads the session transcript ${payload.transcript_path} instead`,
  );
}

function readToolInput(payload: object): object {
  const toolInput = 'tool_input' in payload ? payload.tool_input : undefined;

  return typeof toolInput === 'object' && toolInput !== null ? toolInput : {};
}

function readEditedPath(payload: object): string | undefined {
  const toolInput = readToolInput(payload);
  const editedPath = 'file_path' in toolInput ? toolInput.file_path : '';

  return typeof editedPath === 'string' && editedPath.length > 0 ? editedPath : undefined;
}

function buildGateInvocation(): GateInvocation {
  try {
    const payload = readPayloadObject(readFileSync(0, 'utf8'));
    const subagentAwarePayload = readSubagentAwarePayload(payload);
    const transcriptPath = resolveTranscriptPath(subagentAwarePayload, existsSync);

    announceMissingSubagentRecord(subagentAwarePayload, transcriptPath);

    return {
      payload: JSON.stringify({ ...payload, transcript_path: transcriptPath }),
      configuration: gateConfigurationPath(readEditedPath(payload), CHECKOUT_ROOT, existsSync),
    };
  } catch (cause) {
    return blockToolCall(`the PreToolUse payload was unusable: ${describeFailure(cause)}`);
  }
}

function main(): void {
  const invocation = buildGateInvocation();
  const run = spawnSync(GATE_COMMAND, [...GATE_ARGUMENTS, '--config', invocation.configuration], {
    cwd: CHECKOUT_ROOT,
    input: invocation.payload,
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

if (import.meta.main) {
  main();
}

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { configurationRoot } from './configuration-scope.mts';
import { readEditedPath } from './hook-payload.mts';
import { repositoryDirectories } from './repository-scope.mts';

type SubagentAwarePayload = {
  readonly transcript_path: string;
  readonly agent_id?: string | undefined;
};

type WorkflowListing = (directory: string) => readonly string[];

type RecordSearch = {
  readonly recordExists: (path: string) => boolean;
  readonly listWorkflows: WorkflowListing;
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

function subagentsDirectory(transcriptPath: string): string {
  return `${transcriptPath.replace(/\.jsonl$/, '')}/subagents`;
}

function subagentRecordPath(transcriptPath: string, agentId: string): string {
  return `${subagentsDirectory(transcriptPath)}/agent-${agentId}.jsonl`;
}

function subagentRecordCandidates(
  transcriptPath: string,
  agentId: string,
  listWorkflows: WorkflowListing,
): readonly string[] {
  const workflowsDirectory = `${subagentsDirectory(transcriptPath)}/workflows`;

  return [
    subagentRecordPath(transcriptPath, agentId),
    ...listWorkflows(workflowsDirectory).map(
      (workflow) => `${workflowsDirectory}/${workflow}/agent-${agentId}.jsonl`,
    ),
  ];
}

export function resolveTranscriptPath(payload: SubagentAwarePayload, search: RecordSearch): string {
  const agentId = payload.agent_id;

  if (agentId === undefined) {
    return payload.transcript_path;
  }

  return (
    subagentRecordCandidates(payload.transcript_path, agentId, search.listWorkflows).find(
      search.recordExists,
    ) ?? payload.transcript_path
  );
}

export function gateConfigurationPath(
  editedPath: string | undefined,
  checkoutRoot: string,
  configurationExists: (path: string) => boolean,
  reachableDirectories: (start: string) => readonly string[],
): string {
  return join(
    configurationRoot(editedPath, checkoutRoot, {
      configurationName: GATE_CONFIGURATION_NAME,
      configurationExists,
      reachableDirectories,
    }),
    GATE_CONFIGURATION_NAME,
  );
}

function listWorkflowDirectories(directory: string): readonly string[] {
  return existsSync(directory) ? readdirSync(directory) : [];
}

const RECORD_SEARCH: RecordSearch = {
  recordExists: existsSync,
  listWorkflows: listWorkflowDirectories,
};

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

function buildGateInvocation(): GateInvocation {
  try {
    const payload = readPayloadObject(readFileSync(0, 'utf8'));
    const subagentAwarePayload = readSubagentAwarePayload(payload);
    const transcriptPath = resolveTranscriptPath(subagentAwarePayload, RECORD_SEARCH);

    announceMissingSubagentRecord(subagentAwarePayload, transcriptPath);

    return {
      payload: JSON.stringify({ ...payload, transcript_path: transcriptPath }),
      configuration: gateConfigurationPath(
        readEditedPath(payload),
        CHECKOUT_ROOT,
        existsSync,
        (start) => repositoryDirectories(start, CHECKOUT_ROOT),
      ),
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

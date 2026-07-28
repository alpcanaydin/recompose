import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isProcessEntryPoint } from './entry-point.mjs';

type SubagentAwarePayload = {
  readonly transcript_path: string;
  readonly agent_id?: string | undefined;
};

type WorkflowListing = (directory: string) => readonly string[];

type RecordSearch = {
  readonly recordExists: (path: string) => boolean;
  readonly listWorkflows: WorkflowListing;
};

const CHECKOUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const GATE_COMMAND = join(CHECKOUT_ROOT, 'node_modules', '.bin', 'probity');

const GATE_ARGUMENTS: readonly string[] = ['--agent', 'claude-code'];

const GATE_CONFIGURATION = join(CHECKOUT_ROOT, 'probity.config.ts');

const BLOCKING_EXIT_STATUS = 2;

const ACTION_PATH_PROPERTIES: readonly string[] = ['file_path', 'notebook_path'];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readPayloadObject(raw: string): object {
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed)) {
    throw new Error('the payload is not a JSON object');
  }

  return parsed;
}

function physicalPath(path: string): string {
  const parent = dirname(path);

  if (parent === path) {
    return path;
  }

  try {
    return realpathSync(path);
  } catch {
    return join(physicalPath(parent), basename(path));
  }
}

function physicalActionPaths(toolInput: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(toolInput).map(([property, value]) => [
      property,
      ACTION_PATH_PROPERTIES.includes(property) && typeof value === 'string'
        ? physicalPath(resolve(CHECKOUT_ROOT, value))
        : value,
    ]),
  );
}

function withPhysicalActionPaths(payload: object): object {
  const toolInput = 'tool_input' in payload ? payload.tool_input : undefined;

  if (!isRecord(toolInput)) {
    return payload;
  }

  return { ...payload, tool_input: physicalActionPaths(toolInput) };
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

function buildGatePayload(): string {
  try {
    const payload = readPayloadObject(readFileSync(0, 'utf8'));
    const subagentAwarePayload = readSubagentAwarePayload(payload);
    const transcriptPath = resolveTranscriptPath(subagentAwarePayload, RECORD_SEARCH);

    announceMissingSubagentRecord(subagentAwarePayload, transcriptPath);

    return JSON.stringify({
      ...withPhysicalActionPaths(payload),
      transcript_path: transcriptPath,
    });
  } catch (cause) {
    return blockToolCall(`the PreToolUse payload was unusable: ${describeFailure(cause)}`);
  }
}

function main(): void {
  const run = spawnSync(GATE_COMMAND, [...GATE_ARGUMENTS, '--config', GATE_CONFIGURATION], {
    cwd: CHECKOUT_ROOT,
    input: buildGatePayload(),
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

if (isProcessEntryPoint(import.meta.url)) {
  main();
}

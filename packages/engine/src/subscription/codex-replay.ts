import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { observingSseLines } from './observing-sse';

type ReplayTurn = {
  reasoning: JsonObject[];
  assistantText?: string;
  callIds: string[];
};

const MAX_REPLAY_SESSIONS = 4096;
const MAX_TURNS_PER_SESSION = 256;

function textParts(value: unknown): string {
  return Array.isArray(value)
    ? value
        .flatMap((part) =>
          isJsonObject(part) && typeof part['text'] === 'string' ? [part['text']] : [],
        )
        .join('')
    : '';
}

function assistantText(value: unknown): string | undefined {
  if (!isJsonObject(value) || value['type'] !== 'message' || value['role'] !== 'assistant') {
    return undefined;
  }

  const text = textParts(value['content']);

  return text === '' ? undefined : text;
}

function callId(value: unknown): string | undefined {
  if (
    !isJsonObject(value) ||
    !['function_call', 'custom_tool_call'].includes(String(value['type']))
  ) {
    return undefined;
  }

  return typeof value['call_id'] === 'string' && value['call_id'] !== ''
    ? value['call_id']
    : undefined;
}

function reasoningSignature(value: unknown): string | undefined {
  if (!isJsonObject(value) || value['type'] !== 'reasoning') {
    return undefined;
  }

  return typeof value['encrypted_content'] === 'string' && value['encrypted_content'] !== ''
    ? value['encrypted_content']
    : undefined;
}

function replayReasoning(value: unknown): JsonObject[] {
  const signature = reasoningSignature(value);

  return signature === undefined || !isJsonObject(value)
    ? []
    : [
        {
          type: 'reasoning',
          ...(typeof value['id'] === 'string' ? { id: value['id'] } : {}),
          summary: [],
          content: null,
          encrypted_content: signature,
        },
      ];
}

function turnFromOutput(value: unknown): ReplayTurn | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const reasoning = value.flatMap(replayReasoning);

  if (reasoning.length === 0) {
    return undefined;
  }

  const text = value.map(assistantText).find((candidate) => candidate !== undefined);
  const callIds = value.flatMap((item) => {
    const id = callId(item);

    return id === undefined ? [] : [id];
  });

  return { reasoning, ...(text === undefined ? {} : { assistantText: text }), callIds };
}

function itemMatchesTurn(value: unknown, turn: ReplayTurn): boolean {
  const text = assistantText(value);
  const id = callId(value);

  return (
    (turn.assistantText !== undefined && text === turn.assistantText) ||
    (id !== undefined && turn.callIds.includes(id))
  );
}

function encryptedContent(value: unknown): string | undefined {
  return isJsonObject(value) &&
    value['type'] === 'reasoning' &&
    typeof value['encrypted_content'] === 'string'
    ? value['encrypted_content']
    : undefined;
}

function insertReplayTurns(input: unknown[], turns: readonly ReplayTurn[]): unknown[] {
  const existing = new Set(input.map(encryptedContent).filter((value) => value !== undefined));
  const insertions = new Map<number, JsonObject[]>();

  for (const turn of turns) {
    const at = input.findLastIndex((item) => itemMatchesTurn(item, turn));
    const missing = turn.reasoning.filter(
      (item) => !existing.has(String(item['encrypted_content'])),
    );

    if (at >= 0 && missing.length > 0) {
      insertions.set(at, [...(insertions.get(at) ?? []), ...missing]);
      missing.forEach((item) => {
        existing.add(String(item['encrypted_content']));
      });
    }
  }

  return input.flatMap((item, index) => [...(insertions.get(index) ?? []), item]);
}

export class CodexReasoningReplay {
  readonly #turns = new Map<string, ReplayTurn[]>();

  inject(key: string, body: JsonObject): JsonObject {
    const turns = this.#turns.get(key);
    const input = body['input'];

    if (turns === undefined || !Array.isArray(input)) {
      return body;
    }

    return { ...body, input: insertReplayTurns(input, turns) };
  }

  commit(key: string, output: unknown): void {
    const turn = turnFromOutput(output);

    if (turn === undefined) {
      this.#turns.delete(key);

      return;
    }

    const turns = [...(this.#turns.get(key) ?? []), turn].slice(-MAX_TURNS_PER_SESSION);

    this.#turns.delete(key);
    this.#turns.set(key, turns);
    this.evictOldest();
  }

  clear(key: string): void {
    this.#turns.delete(key);
  }

  private evictOldest(): void {
    if (this.#turns.size <= MAX_REPLAY_SESSIONS) {
      return;
    }

    const oldest = this.#turns.keys().next().value;

    if (typeof oldest === 'string') {
      this.#turns.delete(oldest);
    }
  }
}

function responseIn(value: unknown): JsonObject | undefined {
  const response = isJsonObject(value) ? value['response'] : undefined;

  return isJsonObject(response) ? response : undefined;
}

function completedOutput(value: unknown): unknown {
  const event = isJsonObject(value) ? value : undefined;
  const response = responseIn(event);

  return event?.['type'] === 'response.completed' && response !== undefined
    ? response['output']
    : undefined;
}

function failedEvent(value: unknown): boolean {
  return isJsonObject(value) && value['type'] === 'response.failed';
}

function observeEvent(value: unknown, commit: (output: unknown) => void, clear: () => void): void {
  const output = completedOutput(value);

  if (output !== undefined) {
    commit(output);
  } else if (failedEvent(value)) {
    clear();
  }
}

function observeLine(line: string, commit: (output: unknown) => void, clear: () => void): void {
  if (!line.startsWith('data:')) {
    return;
  }

  try {
    observeEvent(JSON.parse(line.slice(5).trim()), commit, clear);
  } catch {
    return;
  }
}

function observingStream(
  body: ReadableStream<Uint8Array>,
  commit: (output: unknown) => void,
  clear: () => void,
): ReadableStream<Uint8Array> {
  return observingSseLines(body, (line) => {
    observeLine(line, commit, clear);
  });
}

function observableBody(response: Response): ReadableStream<Uint8Array> | undefined {
  return response.ok && response.body !== null ? response.body : undefined;
}

async function observeJson(
  response: Response,
  commit: (output: unknown) => void,
  clear: () => void,
): Promise<Response> {
  const value: unknown = await response
    .clone()
    .json()
    .catch(() => null);

  if (isJsonObject(value) && value['status'] === 'completed') {
    commit(value['output']);
  } else if (isJsonObject(value) && value['status'] === 'failed') {
    clear();
  }

  return response;
}

export async function observeCodexReasoning(
  response: Response,
  commit: (output: unknown) => void,
  clear: () => void,
): Promise<Response> {
  const body = observableBody(response);

  if (body === undefined) {
    return response;
  }

  if (response.headers.get('content-type')?.includes('text/event-stream') === true) {
    return new Response(observingStream(body, commit, clear), response);
  }

  return observeJson(response, commit, clear);
}

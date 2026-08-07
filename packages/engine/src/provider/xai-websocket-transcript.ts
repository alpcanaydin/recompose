import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { validGrokEncryptedContent } from './xai-input';

export type PreparedTranscript = { body: JsonObject; replayed: boolean };
export type ValidatedCompaction = { responseId: string; item: JsonObject };

function objectItems(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function completedOutput(completed: JsonObject): JsonObject[] {
  const response = isJsonObject(completed['response']) ? completed['response'] : completed;

  return objectItems(response['output']);
}

function previousResponse(body: JsonObject): string | undefined {
  const value = body['previous_response_id'];

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function compactionItem(value: unknown): value is JsonObject {
  return (
    isJsonObject(value) &&
    value['type'] === 'compaction' &&
    validGrokEncryptedContent(value['encrypted_content'])
  );
}

export function validateXAICompactionResponse(value: unknown): ValidatedCompaction | null {
  if (!isJsonObject(value) || typeof value['id'] !== 'string' || value['id'].trim() === '') {
    return null;
  }

  const item = objectItems(value['output']).find(compactionItem);

  return item === undefined ? null : { responseId: value['id'].trim(), item };
}

export class XAIWebSocketTranscript {
  private replayOnReset = false;
  private transcript: JsonObject[] = [];

  public snapshot(): JsonObject[] {
    return structuredClone(this.transcript);
  }

  public record(request: JsonObject, completed: JsonObject, reset: boolean): void {
    const input = objectItems(request['input']);
    const output = completedOutput(completed);

    if (reset) {
      this.transcript = [];
      this.replayOnReset = false;
    }

    if (input.length === 0 && output.length === 0) return;

    this.transcript.push(...structuredClone(input), ...structuredClone(output));
  }

  public replaceWithCompaction(item: JsonObject): boolean {
    if (!compactionItem(item)) return false;

    this.transcript = [structuredClone(item)];
    this.replayOnReset = true;

    return true;
  }

  public prepare(body: JsonObject): PreparedTranscript {
    const input = objectItems(body['input']);

    if (previousResponse(body) !== undefined) return { body, replayed: false };

    if (input.length === 0) {
      this.transcript = [];
      this.replayOnReset = false;

      return { body, replayed: false };
    }

    if (!this.replayOnReset || this.transcript.length === 0) return { body, replayed: false };

    this.replayOnReset = false;

    return {
      body: { ...body, input: [...structuredClone(this.transcript), ...input] },
      replayed: true,
    };
  }

  public compactionPayload(body: JsonObject): JsonObject {
    return { ...body, input: this.snapshot() };
  }
}

import type { SpendGrant } from '@recompose/contracts';

import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { validateXAICompactionResponse, XAIWebSocketTranscript } from './xai-websocket-transcript';

export type XAICompactGrant = Extract<SpendGrant, { verdict: 'resolved' }> & {
  spend: { custody: 'credentialed'; provider: 'xai'; credential: string };
};
export type XAITranscriptTurn = { request: JsonObject; reset: boolean };
export type PreparedXAIWebSocketBody = {
  body: JsonObject;
  replayed: boolean;
  reset: boolean;
};

function hasCompactionTrigger(body: JsonObject): boolean {
  const input = body['input'];

  return (
    Array.isArray(input) &&
    input.some((item) => isJsonObject(item) && item['type'] === 'compaction_trigger')
  );
}

function resetTranscript(body: JsonObject, replayed: boolean): boolean {
  const previous = body['previous_response_id'];
  const type = body['type'];

  return (
    (typeof previous !== 'string' || previous.trim() === '') &&
    (type !== 'response.append' || replayed)
  );
}

function compactBody(body: JsonObject, transcript: XAIWebSocketTranscript): JsonObject {
  const {
    previous_response_id: _previous,
    stream: _stream,
    type: _type,
    generate: _generate,
    ...request
  } = body;

  return transcript.compactionPayload(request);
}

function compactError(status: number, value: unknown): JsonObject {
  const error = isJsonObject(value) && value['error'] !== undefined ? value['error'] : value;

  return { type: 'error', status, error: error ?? { message: 'xAI compaction failed' } };
}

function warmupCompleted(event: JsonObject): JsonObject {
  const response = isJsonObject(event['response']) ? event['response'] : {};

  return {
    type: 'response.completed',
    response: {
      ...response,
      status: 'completed',
      output: Array.isArray(response['output']) ? response['output'] : [],
      usage: isJsonObject(response['usage'])
        ? response['usage']
        : { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    },
  };
}

export class XAIWebSocketCompaction {
  private readonly fetchLike: typeof fetch;
  private readonly transcript = new XAIWebSocketTranscript();

  public constructor(fetchLike: typeof fetch) {
    this.fetchLike = fetchLike;
  }

  public isTrigger(body: JsonObject): boolean {
    return hasCompactionTrigger(body);
  }

  public prepare(body: JsonObject): PreparedXAIWebSocketBody {
    const prepared = this.transcript.prepare(body);

    return {
      body: prepared.body,
      replayed: prepared.replayed,
      reset: resetTranscript(prepared.body, prepared.replayed),
    };
  }

  public observe(turn: XAITranscriptTurn | undefined, event: JsonObject): JsonObject | undefined {
    if (turn === undefined) return undefined;

    if (event['type'] === 'response.completed') {
      this.transcript.record(turn.request, event, turn.reset);

      return undefined;
    }

    if (event['type'] !== 'response.created' || turn.request['generate'] !== false)
      return undefined;

    const completed = warmupCompleted(event);

    this.transcript.record(turn.request, completed, turn.reset);

    return completed;
  }

  public async compact(
    grant: XAICompactGrant,
    crossing: Crossing,
    body: JsonObject,
    headers: Record<string, string>,
  ): Promise<JsonObject> {
    if (this.transcript.snapshot().length === 0) {
      return compactError(400, { message: 'xAI WebSocket compaction context is empty' });
    }

    const response = await this.fetchLike(
      `${grant.providerOrigin.replace(/\/+$/u, '')}/responses/compact`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(compactBody(body, this.transcript)),
      },
    );
    const value: unknown = await response.json().catch(() => undefined);

    if (!response.ok) return compactError(response.status, value);

    const validated = validateXAICompactionResponse(value);

    if (validated === null)
      return compactError(502, { message: 'invalid xAI compaction response' });

    this.transcript.replaceWithCompaction(validated.item, validated.responseId);

    return { type: 'response.compaction.done', response: value, model: crossing.providerModel };
  }
}

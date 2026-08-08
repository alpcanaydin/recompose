import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

export class XAIWebSocketResponseIDs {
  private readonly downstreamToUpstream = new Map<string, string>();
  private readonly seen = new Map<string, number>();
  private previousDownstream: string | undefined;

  public prepareRequest(body: JsonObject): JsonObject {
    const previous = nonBlank(body['previous_response_id']);

    this.previousDownstream = previous;

    if (previous === undefined) return body;

    return {
      ...body,
      previous_response_id: this.downstreamToUpstream.get(previous) ?? previous,
    };
  }

  public rewrite(value: unknown): unknown {
    if (!isCompleted(value)) return value;

    const response = value.response;
    const upstreamId = nonBlank(response['id']);

    if (upstreamId === undefined) return value;

    const count = (this.seen.get(upstreamId) ?? 0) + 1;
    const downstreamId = count === 1 ? upstreamId : `${upstreamId}_recompose_${String(count)}`;

    this.seen.set(upstreamId, count);
    this.downstreamToUpstream.set(downstreamId, upstreamId);

    return {
      ...value,
      response: rewrittenResponse(response, upstreamId, downstreamId, this.previousDownstream),
    };
  }
}

function rewrittenResponse(
  response: JsonObject,
  upstreamId: string,
  downstreamId: string,
  previous: string | undefined,
): JsonObject {
  const output = Array.isArray(response['output'])
    ? response['output'].map((item) => rewrittenItem(item, upstreamId, downstreamId))
    : response['output'];

  return {
    ...response,
    id: downstreamId,
    ...(output === undefined ? {} : { output }),
    ...(previous === undefined ? {} : { previous_response_id: previous }),
  };
}

function rewrittenItem(item: unknown, upstreamId: string, downstreamId: string): unknown {
  if (!isJsonObject(item) || typeof item['id'] !== 'string') return item;

  return { ...item, id: item['id'].replace(upstreamId, downstreamId) };
}

function isCompleted(value: unknown): value is JsonObject & { response: JsonObject } {
  return (
    isJsonObject(value) && value['type'] === 'response.completed' && isJsonObject(value['response'])
  );
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

type EventNormalizer = (value: JsonObject) => unknown[];

const reasoningNormalizers = new Map<string, EventNormalizer>([
  ['response.content_part.added', (value) => [reasoningPartAdded(value)]],
  [
    'response.reasoning_text.delta',
    (value) => [{ ...value, type: 'response.reasoning_summary_text.delta', summary_index: 0 }],
  ],
  ['response.reasoning_text.done', reasoningDone],
  ['response.output_item.done', (value) => [reasoningItemDone(value)]],
]);

export function normalizeXAIReasoningEvent(value: unknown): unknown[] {
  if (!isJsonObject(value) || typeof value['type'] !== 'string') return [value];

  return reasoningNormalizers.get(value['type'])?.(value) ?? [value];
}

export function xaiResponseIDsFor(
  states: Map<string, XAIWebSocketResponseIDs>,
  key: string,
): XAIWebSocketResponseIDs {
  const existing = states.get(key);

  if (existing !== undefined) return existing;

  const created = new XAIWebSocketResponseIDs();

  states.set(key, created);

  return created;
}

function reasoningPartAdded(value: JsonObject): JsonObject {
  const part = isJsonObject(value['part']) ? value['part'] : null;

  return part?.['type'] === 'reasoning_text'
    ? {
        ...value,
        type: 'response.reasoning_summary_part.added',
        summary_index: 0,
        part: { ...part, type: 'summary_text' },
      }
    : value;
}

function reasoningDone(value: JsonObject): JsonObject[] {
  const text = typeof value['text'] === 'string' ? value['text'] : '';
  const shared = { ...value, summary_index: 0 };

  return [
    { ...shared, type: 'response.reasoning_summary_text.done' },
    {
      ...shared,
      type: 'response.reasoning_summary_part.done',
      part: { type: 'summary_text', text },
    },
  ];
}

function reasoningItemDone(value: JsonObject): JsonObject {
  const item = isJsonObject(value['item']) ? value['item'] : null;

  if (item?.['type'] !== 'reasoning' || !Array.isArray(item['content'])) return value;

  const summary = item['content'].flatMap((part) => {
    if (!isJsonObject(part) || part['type'] !== 'reasoning_text') return [];

    return [{ type: 'summary_text', text: part['text'] ?? '' }];
  });

  return { ...value, item: { ...item, summary, content: [] } };
}

export function requiresXAIWebSocketReplay(body: JsonObject, required: boolean): boolean {
  if (!required || !Array.isArray(body['input'])) return false;

  return body['input'].some((item) => isJsonObject(item) && item['type'] === 'compaction_trigger');
}

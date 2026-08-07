import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { observingSseLines } from '../subscription/observing-sse';
import { XAIReasoningReplay } from './xai-replay';

const replay = new XAIReasoningReplay();

function replayScope(crossing: Crossing): string | undefined {
  return crossing.dialect === 'anthropic' || crossing.dialect === 'responses'
    ? crossing.replayScopeId
    : undefined;
}

function replayKey(crossing: Crossing, scope: string): string {
  return `${crossing.providerModel}\0${scope}`;
}

export function prepareXAIReplay(crossing: Crossing, body: JsonObject): JsonObject {
  const scope = replayScope(crossing);

  return scope === undefined ? body : replay.inject(replayKey(crossing, scope), body);
}

class XAIReplayObserver {
  readonly #items = new Map<number, JsonObject>();

  public observe(line: string, crossing: Crossing, scope: string): void {
    const trimmed = line.trim();

    if (!trimmed.startsWith('data:')) return;

    const event = parsedJson(trimmed.slice('data:'.length).trim());

    if (!isJsonObject(event)) return;

    if (event['type'] === 'response.output_item.done') this.#collect(event);
    if (event['type'] === 'response.completed') this.#commit(event, crossing, scope);
  }

  #collect(event: JsonObject): void {
    const index = event['output_index'];
    const item = event['item'];

    if (typeof index === 'number' && isJsonObject(item)) this.#items.set(index, item);
  }

  #commit(event: JsonObject, crossing: Crossing, scope: string): void {
    const response = event['response'];
    const output =
      isJsonObject(response) && Array.isArray(response['output']) ? response['output'] : [];
    const collected = [...this.#items.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, item]) => item);

    replay.commit(replayKey(crossing, scope), output.length > 0 ? output : collected);
  }
}

function replayBody(response: Response): ReadableStream<Uint8Array> | undefined {
  const streaming = response.headers.get('content-type')?.includes('text/event-stream') === true;

  return response.ok && streaming && response.body !== null ? response.body : undefined;
}

export function observeXAIReplay(crossing: Crossing, response: Response): Response {
  const scope = replayScope(crossing);
  const source = replayBody(response);

  if (scope === undefined || source === undefined) return response;

  const observer = new XAIReplayObserver();
  const body = observingSseLines(source, (line) => {
    observer.observe(line, crossing, scope);
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function clearXAIReplayCache(): void {
  replay.clear();
}

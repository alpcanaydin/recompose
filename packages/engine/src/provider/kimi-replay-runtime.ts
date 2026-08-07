import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { observingSseLines } from '../subscription/observing-sse';
import { KimiStreamReplayAccumulator } from './kimi-stream-replay';
import { KimiThinkingReplay, replayableKimiThinkingContent } from './kimi-thinking-replay';

const replay = new KimiThinkingReplay();
const applied = new WeakSet<Crossing>();

function replayScope(crossing: Crossing): string | undefined {
  return crossing.dialect === 'anthropic' ? crossing.replayScopeId : undefined;
}

export function prepareKimiReplay(crossing: Crossing, body: JsonObject): JsonObject {
  const scope = replayScope(crossing);

  if (scope === undefined) return body;

  const injected = replay.inject(crossing.providerModel, scope, body);

  if (injected.applied) applied.add(crossing);

  return injected.body;
}

function responseContent(value: unknown): unknown[] | undefined {
  if (!isJsonObject(value)) return undefined;

  return Array.isArray(value['content']) ? value['content'] : undefined;
}

function recordContent(crossing: Crossing, scope: string, content: unknown[]): void {
  if (replayableKimiThinkingContent(content)) replay.commit(crossing.providerModel, scope, content);
  else replay.clear(crossing.providerModel, scope);
}

function rejectedReplay(crossing: Crossing, response: Response): boolean {
  return applied.has(crossing) && (response.status === 400 || response.status === 422);
}

function clearRejectedReplay(crossing: Crossing, scope: string, response: Response): boolean {
  if (!rejectedReplay(crossing, response)) return false;

  replay.clear(crossing.providerModel, scope);

  return true;
}

function finishStreamReplay(
  crossing: Crossing,
  scope: string,
  accumulator: KimiStreamReplayAccumulator,
): void {
  const content = accumulator.content();

  if (content !== undefined) {
    recordContent(crossing, scope, content);

    return;
  }

  if (accumulator.upstreamError && applied.has(crossing)) {
    replay.clear(crossing.providerModel, scope);
  }
}

function observedStream(crossing: Crossing, scope: string, response: Response): Response {
  const body = response.body;

  if (body === null) return response;

  const accumulator = new KimiStreamReplayAccumulator();
  const observed = observingSseLines(
    body,
    (line) => {
      accumulator.observeLine(line);
    },
    () => {
      finishStreamReplay(crossing, scope, accumulator);
    },
  );

  return new Response(observed, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function observeSuccessful(
  crossing: Crossing,
  scope: string,
  response: Response,
): Promise<Response> {
  const streaming = response.headers.get('content-type')?.includes('text/event-stream') === true;

  if (!response.ok) return response;
  if (streaming) return observedStream(crossing, scope, response);

  const content = responseContent(
    await response
      .clone()
      .json()
      .catch(() => undefined),
  );

  if (content !== undefined) recordContent(crossing, scope, content);

  return response;
}

export async function observeKimiReplay(crossing: Crossing, response: Response): Promise<Response> {
  const scope = replayScope(crossing);

  if (scope === undefined) return response;
  if (clearRejectedReplay(crossing, scope, response)) return response;

  return observeSuccessful(crossing, scope, response);
}

export function clearKimiReplayCache(): void {
  replay.clearAll();
}

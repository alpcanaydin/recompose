import type { SubscriptionProviderId } from '@recompose/contracts';

import type { JsonObject } from '../gateway-wire';
import type { AntigravityReasoningReplay } from './antigravity-replay';

import { isJsonObject } from '../gateway-wire';
import { antigravityReplayKey, replayedAntigravityBody } from './antigravity-replay';

type FunctionRef = { id: string; name: string };

function refOf(part: unknown, key: 'functionCall' | 'functionResponse'): FunctionRef | null {
  if (!isJsonObject(part) || !isJsonObject(part[key])) return null;

  const value = part[key];
  const id = typeof value['id'] === 'string' ? value['id'] : '';
  const name = typeof value['name'] === 'string' ? value['name'] : '';

  return { id, name };
}

function refsOf(parts: unknown[], key: 'functionCall' | 'functionResponse'): FunctionRef[] {
  const refs = parts.map((part) => refOf(part, key));

  return refs.filter((ref): ref is FunctionRef => ref !== null);
}

function pairError(call: FunctionRef, response: FunctionRef): string | null {
  return pairIdError(call, response) ?? pairNameError(call, response);
}

function pairIdError(call: FunctionRef, response: FunctionRef): string | null {
  if (call.id !== '' && response.id === '') return 'missing functionResponse.id';
  if (call.id !== '' && response.id !== call.id) return 'functionResponse.id mismatch';

  return null;
}

function pairNameError(call: FunctionRef, response: FunctionRef): string | null {
  if (response.name === '') return 'missing functionResponse.name';
  if (call.name !== response.name) return 'functionResponse.name mismatch';

  return null;
}

function responsesError(pending: FunctionRef[], responses: FunctionRef[]): string | null {
  if (pending.length === 0) return 'functionResponse without preceding functionCall';
  if (pending.length !== responses.length) return 'functionResponse count mismatch';

  for (const [index, response] of responses.entries()) {
    const error = indexedPairError(pending, response, index);

    if (error !== null) return error;
  }

  return null;
}

function indexedPairError(
  pending: FunctionRef[],
  response: FunctionRef,
  index: number,
): string | null {
  const call = pending[index];

  return call === undefined ? 'functionResponse count mismatch' : pairError(call, response);
}

function callsError(pending: FunctionRef[], calls: FunctionRef[]): string | null {
  if (calls.some((call) => call.name === '')) return 'missing functionCall.name';

  return pending.length === 0 ? null : 'functionCall before pending functionResponse';
}

export function antigravityPairingError(body: JsonObject): string | null {
  const rawContents = body['contents'];

  if (!Array.isArray(rawContents)) return null;

  const contents: unknown[] = rawContents;
  let pending: FunctionRef[] = [];

  for (const content of contents) {
    const result = contentPairingError(content, pending);

    if (result.error !== null) return result.error;

    pending = result.pending;
  }

  return null;
}

function contentPairingError(
  content: unknown,
  pending: FunctionRef[],
): { error: string | null; pending: FunctionRef[] } {
  const parts = contentParts(content);

  if (parts === null) return withoutCalls(pending, []);

  const calls = refsOf(parts, 'functionCall');
  const responses = refsOf(parts, 'functionResponse');
  const mixedError = interleavedError(calls, responses);

  if (mixedError !== null) return { error: mixedError, pending };

  return calls.length > 0
    ? { error: callsError(pending, calls), pending: calls }
    : withoutCalls(pending, responses);
}

function contentParts(content: unknown): unknown[] | null {
  if (!isJsonObject(content)) return null;

  const parts = content['parts'];

  return Array.isArray(parts) ? parts : null;
}

function interleavedError(calls: FunctionRef[], responses: FunctionRef[]): string | null {
  return calls.length > 0 && responses.length > 0
    ? 'functionCall and functionResponse interleaved'
    : null;
}

function withoutCalls(
  pending: FunctionRef[],
  responses: FunctionRef[],
): { error: string | null; pending: FunctionRef[] } {
  if (responses.length > 0) return { error: responsesError(pending, responses), pending: [] };

  return {
    error: pending.length === 0 ? null : 'content before pending functionResponse',
    pending,
  };
}

function invalidPairingResponse(error: string): Response {
  return Response.json(
    {
      error: {
        code: 400,
        message: `invalid Gemini function call history: ${error}`,
        status: 'INVALID_ARGUMENT',
      },
    },
    { status: 400 },
  );
}

export function antigravityPairingPreflight(
  spend: { provider: SubscriptionProviderId; accountId: string },
  body: JsonObject,
  replay: AntigravityReasoningReplay | undefined,
  sessionId: string,
): Response | null {
  if (spend.provider !== 'antigravity') return null;

  const originalError = antigravityPairingError(body);
  const replayed = replayedAntigravityBody(replay, spend.accountId, body, sessionId);
  const replayError = antigravityPairingError(replayed);

  if (replayError === null) return null;

  if (originalError === null) {
    replay?.clear(antigravityReplayKey(spend.accountId, body, sessionId));
  }

  return invalidPairingResponse(replayError);
}

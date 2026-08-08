import { expect, test } from 'vitest';

import {
  normalizeXAIReasoningEvent,
  requiresXAIWebSocketReplay,
  XAIWebSocketResponseIDs,
} from './xai-websocket-response';

test('TestXAIWebsocketsRequiredUpstreamRejectsCompactionHTTPFallback', () => {
  expect(requiresXAIWebSocketReplay({ input: [{ type: 'compaction_trigger' }] }, true)).toBe(true);
  expect(requiresXAIWebSocketReplay({ input: [{ type: 'compaction_trigger' }] }, false)).toBe(
    false,
  );
});

test('TestXAIWebsocketsExecuteStreamNormalizesReasoningTextEvents', () => {
  const added = normalizeXAIReasoningEvent({
    type: 'response.content_part.added',
    part: { type: 'reasoning_text', text: '' },
  });
  const delta = normalizeXAIReasoningEvent({
    type: 'response.reasoning_text.delta',
    delta: 'thinking',
  });
  const done = normalizeXAIReasoningEvent({
    type: 'response.reasoning_text.done',
    text: 'thinking',
  });
  const item = normalizeXAIReasoningEvent({
    type: 'response.output_item.done',
    item: {
      type: 'reasoning',
      content: [{ type: 'reasoning_text', text: 'thinking' }],
    },
  });

  expect(JSON.stringify([added, delta, done, item])).not.toContain('reasoning_text');
  expect(done.map(eventType)).toEqual([
    'response.reasoning_summary_text.done',
    'response.reasoning_summary_part.done',
  ]);
  expect(item[0]).toHaveProperty('item.summary.0', {
    type: 'summary_text',
    text: 'thinking',
  });
});

test('TestXAIWebsocketsExecuteStreamRewritesRepeatedResponseIDForDownstream', () => {
  const ids = new XAIWebSocketResponseIDs();
  const first = ids.rewrite(completed('resp-real', 'rs_resp-real'));
  const secondRequest = ids.prepareRequest({ previous_response_id: 'resp-real' });
  const second = ids.rewrite(completed('resp-real', 'rs_resp-real', 'resp-real'));
  const secondId = responseId(second);
  const thirdRequest = ids.prepareRequest({ previous_response_id: secondId });
  const third = ids.rewrite(completed('resp-real', 'rs_resp-real', 'resp-real'));

  expect(responseId(first)).toBe('resp-real');
  expect(secondId).not.toBe('resp-real');
  expect(outputId(second)).toContain(secondId);
  expect(responsePrevious(second)).toBe('resp-real');
  expect(secondRequest).toHaveProperty('previous_response_id', 'resp-real');
  expect(thirdRequest).toHaveProperty('previous_response_id', 'resp-real');
  expect(responsePrevious(third)).toBe(secondId);
  expect(responseId(third)).not.toBe(secondId);
});

test('TestXAIWebsocketsExecuteStreamRewritesRepeatedResponseIDWithoutPreviousResponseID', () => {
  const ids = new XAIWebSocketResponseIDs();
  const first = ids.rewrite(completed('resp-real', 'msg_resp-real'));

  ids.prepareRequest({ input: [] });
  const second = ids.rewrite(completed('resp-real', 'msg_resp-real'));

  expect(responseId(first)).toBe('resp-real');
  expect(responseId(second)).not.toBe('resp-real');
  expect(outputId(second)).toContain(responseId(second));

  expect(responsePrevious(second)).toBeUndefined();
});

function completed(id: string, outputId: string, previous?: string) {
  return {
    type: 'response.completed',
    response: {
      id,
      ...(previous === undefined ? {} : { previous_response_id: previous }),
      output: [{ id: outputId, type: 'reasoning' }],
    },
  };
}

function responseOf(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};

  const response = value['response'];

  return isRecord(response) ? response : {};
}

function responseId(value: unknown): string {
  const id = responseOf(value)['id'];

  return typeof id === 'string' ? id : '';
}

function outputId(value: unknown): string {
  const output = responseOf(value)['output'];
  const item = firstItem(output);

  return isRecord(item) && typeof item['id'] === 'string' ? item['id'] : '';
}

function firstItem(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;

  const items: unknown[] = Array.from(value);

  return items[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function eventType(value: unknown): unknown {
  return isRecord(value) ? value['type'] : undefined;
}

function responsePrevious(value: unknown): string | undefined {
  const previous = responseOf(value)['previous_response_id'];

  return typeof previous === 'string' ? previous : undefined;
}

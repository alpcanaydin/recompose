import { expect, test } from 'vitest';

import { observeCodexReasoning } from './codex-replay-observer';

type Observation = { commits: unknown[]; cleared: number };

function observation(): Observation {
  return { commits: [], cleared: 0 };
}

async function observed(response: Response, seen: Observation): Promise<string> {
  const answer = await observeCodexReasoning(
    response,
    (output) => {
      seen.commits.push(output);
    },
    () => {
      seen.cleared += 1;
    },
  );

  return answer.text();
}

function streamed(events: readonly unknown[]): Response {
  const lines = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(lines, { headers: { 'content-type': 'text/event-stream' } });
}

function jsonAnswer(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'application/json' } });
}

test('leaves a failed answer unobserved', async () => {
  const seen = observation();

  await observed(new Response('{}', { status: 500 }), seen);

  expect(seen).toEqual({ commits: [], cleared: 0 });
});

test('collects streamed items that carry no usable output index', async () => {
  const seen = observation();
  const item = { id: 'rs_1', type: 'reasoning' };

  await observed(
    streamed([
      { type: 'response.output_item.done', output_index: -1, item },
      { type: 'response.output_item.done', output_index: 1.5, item },
      { type: 'response.completed', response: { output: [] } },
    ]),
    seen,
  );

  expect(seen.commits).toEqual([[item, item]]);
});

test('ignores a streamed event that is not an object', async () => {
  const seen = observation();

  await observed(streamed(['text', 7]), seen);

  expect(seen).toEqual({ commits: [], cleared: 0 });
});

test('clears the replay when a non-streaming answer reports an invalid signature', async () => {
  const seen = observation();
  const failure = { type: 'error', error: { code: 'thinking_signature_invalid', message: 'bad' } };

  await observed(jsonAnswer(JSON.stringify(failure)), seen);

  expect(seen).toMatchObject({ commits: [], cleared: 1 });
});

test('ignores a non-streaming answer whose body is not JSON', async () => {
  const seen = observation();

  await observed(jsonAnswer('not-json'), seen);

  expect(seen).toEqual({ commits: [], cleared: 0 });
});

test('ignores a non-streaming answer that reports no invalid signature', async () => {
  const seen = observation();

  await observed(jsonAnswer('{"status":"in_progress"}'), seen);

  expect(seen).toEqual({ commits: [], cleared: 0 });
});

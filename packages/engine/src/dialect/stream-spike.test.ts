import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

async function pause(ms: number): Promise<void> {
  await new Promise<void>((settle) => {
    setTimeout(settle, ms);
  });
}

async function* upcaseFrames(source: AsyncIterable<string>): AsyncIterable<string> {
  for await (const frame of source) {
    yield frame.toUpperCase();
  }
}

async function* fromArray(frames: readonly string[], gapMs: number): AsyncIterable<string> {
  for (const frame of frames) {
    if (gapMs > 0) {
      await pause(gapMs);
    }

    yield frame;
  }
}

async function* thenErrorFrame(
  frames: readonly string[],
  errorFrame: string,
): AsyncIterable<string> {
  yield* fromArray(frames, 0);
  yield errorFrame;
}

function bodyFrom(transformed: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = transformed[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const step = await iterator.next();

        if (step.done === true) {
          controller.close();

          return;
        }

        controller.enqueue(encoder.encode(`${step.value}\n`));
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

type RunningSpike = {
  readonly url: string;
  readonly close: () => Promise<void>;
};

async function serve(transformed: AsyncIterable<string>): Promise<RunningSpike> {
  const app = new Hono();

  app.get('/stream', (c) => c.body(bodyFrom(transformed)));

  const answer = getRequestListener(app.fetch);
  const server: Server = createServer((incoming, outgoing) => {
    void answer(incoming, outgoing);
  });

  await new Promise<void>((settle) => {
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      settle();
    });
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('the spike server never bound an ephemeral port');
  }

  const port = address.port;

  return {
    url: `http://127.0.0.1:${String(port)}/stream`,
    close: async () => {
      await new Promise<void>((settle) => {
        server.closeAllConnections();
        server.close(() => {
          settle();
        });
      });
    },
  };
}

function bodyOf(response: Response): ReadableStream<Uint8Array> {
  if (response.body === null) {
    throw new Error('the streamed response carried no body');
  }

  return response.body;
}

function drainFrames(buffer: string, frames: string[]): string {
  let rest = buffer;
  let newlineAt = rest.indexOf('\n');

  while (newlineAt >= 0) {
    frames.push(rest.slice(0, newlineAt));
    rest = rest.slice(newlineAt + 1);
    newlineAt = rest.indexOf('\n');
  }

  return rest;
}

async function readFrames(response: Response, gapMs: number): Promise<string[]> {
  const reader = bodyOf(response).getReader();
  const decoder = new TextDecoder();
  const frames: string[] = [];
  let buffer = '';

  for (;;) {
    const step = await reader.read();

    if (step.done) {
      break;
    }

    buffer = drainFrames(buffer + decoder.decode(step.value, { stream: true }), frames);

    if (gapMs > 0) {
      await pause(gapMs);
    }
  }

  return frames;
}

describe('the streaming spike: a pure async-iterable transform serves through the adapter', () => {
  let running: RunningSpike | undefined;

  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it('serves the transform output in order and ends clean with no trailing frame', async () => {
    running = await serve(upcaseFrames(fromArray(['one', 'two', 'three'], 0)));

    const frames = await readFrames(await fetch(running.url), 0);

    expect(frames).toEqual(['ONE', 'TWO', 'THREE']);
  });

  it('holds backpressure so a slow consumer never deadlocks', async () => {
    running = await serve(upcaseFrames(fromArray(['a', 'b', 'c', 'd'], 0)));

    const frames = await readFrames(await fetch(running.url), 40);

    expect(frames.join('')).toBe('ABCD');
  });

  it('carries a failure as a terminal error frame the codec yields, then ends clean', async () => {
    running = await serve(upcaseFrames(thenErrorFrame(['kept'], 'error: overloaded')));

    const frames = await readFrames(await fetch(running.url), 0);

    expect(frames).toEqual(['KEPT', 'ERROR: OVERLOADED']);
  });
});

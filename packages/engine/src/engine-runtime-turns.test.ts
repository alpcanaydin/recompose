import { describe, expect, test } from 'vitest';

import { createEngineRuntime, type OpenListeners } from './engine-runtime';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };

function aLoopbackThatClosesSlowly() {
  const serving = new Set<number>();
  const waiting: (() => void)[] = [];

  return {
    serving,
    finishClosing: () => {
      for (const release of waiting.splice(0)) {
        release();
      }
    },
    openListeners: (async (_app, port) => {
      if (serving.has(port)) {
        return Promise.resolve({ failed: { port } });
      }

      serving.add(port);

      return Promise.resolve({
        opened: {
          close: async () =>
            new Promise<void>((settle) => {
              waiting.push(() => {
                serving.delete(port);
                settle();
              });
            }),
        },
      });
    }) satisfies OpenListeners,
  };
}

describe('a start arriving while the last stop is still closing', () => {
  test('it waits for the port to come back rather than reporting it taken', async () => {
    const loopback = aLoopbackThatClosesSlowly();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);

    const stopping = runtime.stop(codex.slug);
    const starting = runtime.start(codex);

    await new Promise((settle) => {
      setTimeout(settle, 0);
    });
    loopback.finishClosing();

    expect(await stopping).toEqual({ status: 'stopped' });
    expect(await starting).toEqual({ status: 'running' });
  });
});

describe('two stops arriving at once', () => {
  test('the second joins the first rather than closing a listener already gone', async () => {
    const loopback = aLoopbackThatClosesSlowly();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);

    const first = runtime.stop(codex.slug);
    const second = runtime.stop(codex.slug);

    await new Promise((settle) => {
      setTimeout(settle, 0);
    });
    loopback.finishClosing();

    expect(await first).toEqual({ status: 'stopped' });
    expect(await second).toEqual({ status: 'stopped' });
  });
});

describe('a listener that blows up rather than answering', () => {
  const blowsUp: OpenListeners = async () => Promise.reject(new Error('the loopback gave way'));

  test('a stop after a failed start still reports the gateway stopped', async () => {
    const runtime = createEngineRuntime(blowsUp);

    await expect(runtime.start(codex)).rejects.toThrow('the loopback gave way');

    expect(await runtime.stop(codex.slug)).toEqual({ status: 'stopped' });
  });

  test('a start after a failed stop tries again rather than waiting on the wreck', async () => {
    const runtime = createEngineRuntime(blowsUp);
    const failing = runtime.start(codex);

    await expect(runtime.stop(codex.slug)).resolves.toEqual({ status: 'stopped' });
    await expect(failing).rejects.toThrow('the loopback gave way');
    await expect(runtime.start(codex)).rejects.toThrow('the loopback gave way');
  });
});

describe('a stop that follows a start, both arriving during an older stop', () => {
  test('the gateway is really down once that stop reports it, rather than coming back up behind it', async () => {
    const loopback = aLoopbackThatClosesSlowly();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);

    const first = runtime.stop(codex.slug);
    const restarting = runtime.start(codex);
    const second = runtime.stop(codex.slug);

    for (let release = 0; release < 4; release += 1) {
      await new Promise((settle) => {
        setTimeout(settle, 0);
      });
      loopback.finishClosing();
    }

    await first;
    await restarting;
    await second;

    expect(loopback.serving.has(codex.port)).toBe(false);
  });
});

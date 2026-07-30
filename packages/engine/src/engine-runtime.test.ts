import { describe, expect, test } from 'vitest';

import { createEngineRuntime, type OpenListeners } from './engine-runtime';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397 };
const gemini = { slug: 'gemini', displayName: 'Gemini', port: 8398 };

type Loopback = {
  serving: Set<number>;
  hold: (port: number) => void;
  release: (port: number) => void;
  openListeners: OpenListeners;
};

function aLoopback(): Loopback {
  const serving = new Set<number>();
  const held = new Set<number>();

  return {
    serving,
    hold: (port) => {
      held.add(port);
    },
    release: (port) => {
      held.delete(port);
    },
    openListeners: async (_app, port) => {
      if (held.has(port) || serving.has(port)) {
        return Promise.resolve({ failed: { port } });
      }

      serving.add(port);

      return Promise.resolve({
        opened: {
          close: async () => {
            serving.delete(port);

            return Promise.resolve();
          },
        },
      });
    },
  };
}

describe('starting a gateway', () => {
  test('a started gateway serves on its own port and reports running', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
    expect(loopback.serving).toEqual(new Set([codex.port]));
  });

  test('a gateway whose port another process holds reports the port it wanted', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    loopback.hold(codex.port);

    expect(await runtime.start(codex)).toEqual({
      status: 'stopped',
      failure: { port: codex.port },
    });
  });

  test('a failed start leaves every other gateway serving', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(gemini);
    loopback.hold(codex.port);
    await runtime.start(codex);

    expect(loopback.serving).toEqual(new Set([gemini.port]));
  });

  test('a retry serves once the port frees', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    loopback.hold(codex.port);
    await runtime.start(codex);
    loopback.release(codex.port);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
  });

  test('starting a gateway that already serves reports running again', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
  });

  test('a repeated start opens no second listener the first stop would leave behind', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);
    await runtime.start(codex);
    await runtime.stop(codex.slug);

    expect(loopback.serving).toEqual(new Set());
  });
});

describe('stopping a gateway', () => {
  test('a stopped gateway answers nowhere and reports stopped', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);

    expect(await runtime.stop(codex.slug)).toEqual({ status: 'stopped' });
    expect(loopback.serving).toEqual(new Set());
  });

  test('stopping one of two leaves the other serving', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);
    await runtime.start(gemini);
    await runtime.stop(codex.slug);

    expect(loopback.serving).toEqual(new Set([gemini.port]));
  });

  test('stopping a gateway nobody started reports stopped and changes nothing', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(gemini);

    expect(await runtime.stop(codex.slug)).toEqual({ status: 'stopped' });
    expect(loopback.serving).toEqual(new Set([gemini.port]));
  });

  test('a stopped gateway starts again on the port it released', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners);

    await runtime.start(codex);
    await runtime.stop(codex.slug);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
    expect(loopback.serving).toEqual(new Set([codex.port]));
  });
});

import { describe, expect, test } from 'vitest';

import { createEngineRuntime, type OpenListeners } from './engine-runtime';
import {
  aGatewayHolding,
  aLoopbackCapturing,
  aVirtualModel,
  granting,
  grantsNothing,
  neverFetches,
  openedApp,
} from './gateway-app.testkit';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };
const gemini = { slug: 'gemini', displayName: 'Gemini', port: 8398, virtualModels: [] };

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

function aLoopbackThatOpensSlowly() {
  const serving = new Set<number>();
  const waiting: (() => void)[] = [];

  const openListeners: OpenListeners = async (_app, port) => {
    await new Promise<void>((release) => {
      waiting.push(release);
    });

    if (serving.has(port)) {
      return { failed: { port } };
    }

    serving.add(port);

    return {
      opened: {
        close: async () => {
          serving.delete(port);

          return Promise.resolve();
        },
      },
    };
  };

  return {
    serving,
    finishOpening: () => {
      for (const release of waiting.splice(0)) {
        release();
      }
    },
    openListeners,
  };
}

describe('starting a gateway', () => {
  test('a started gateway serves on its own port and reports running', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
    expect(loopback.serving).toEqual(new Set([codex.port]));
  });

  test('a gateway whose port another process holds reports the port it wanted', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    loopback.hold(codex.port);

    expect(await runtime.start(codex)).toEqual({
      status: 'stopped',
      failure: { port: codex.port },
    });
  });

  test('a failed start leaves every other gateway serving', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(gemini);
    loopback.hold(codex.port);
    await runtime.start(codex);

    expect(loopback.serving).toEqual(new Set([gemini.port]));
  });

  test('a retry serves once the port frees', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    loopback.hold(codex.port);
    await runtime.start(codex);
    loopback.release(codex.port);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
  });

  test('starting a gateway that already serves reports running again', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(codex);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
  });

  test('a repeated start opens no second listener the first stop would leave behind', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(codex);
    await runtime.start(codex);
    await runtime.stop(codex.slug);

    expect(loopback.serving).toEqual(new Set());
  });
});

describe('the bindings a start carries into serving', () => {
  test('a started gateway lists the virtual models its directive carried', async () => {
    const capturing = aLoopbackCapturing();
    const runtime = createEngineRuntime(capturing.openListeners, grantsNothing);

    await runtime.start(aGatewayHolding(aVirtualModel()));

    const listing = await openedApp(capturing).request('http://127.0.0.1:8397/v1/models');

    expect(await listing.json()).toMatchObject({ data: [{ id: 'fast' }] });
  });

  test('a proxied request consults the spend seam the runtime carries', async () => {
    const capturing = aLoopbackCapturing();
    const grants = granting({ verdict: 'missing-credential' });
    const runtime = createEngineRuntime(capturing.openListeners, grants.grantFor, neverFetches);

    await runtime.start(aGatewayHolding(aVirtualModel()));

    const answer = await openedApp(capturing).request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', messages: [] }),
    });

    expect(answer.status).toBe(502);
    expect(grants.asked).toEqual([{ slug: 'codex', virtualModel: 'fast' }]);
  });
});

describe('a directive arriving while the gateway is still opening', () => {
  test('a second start reports running, not the gateway holding its own port', async () => {
    const loopback = aLoopbackThatOpensSlowly();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    const first = runtime.start(codex);
    const second = runtime.start(codex);

    loopback.finishOpening();

    await expect(first).resolves.toEqual({ status: 'running' });
    await expect(second).resolves.toEqual({ status: 'running' });
  });

  test('a second start leaves one listener, which one stop closes', async () => {
    const loopback = aLoopbackThatOpensSlowly();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    const first = runtime.start(codex);
    const second = runtime.start(codex);

    loopback.finishOpening();
    await first;
    await second;
    await runtime.stop(codex.slug);

    expect(loopback.serving).toEqual(new Set());
  });

  test('a stop leaves nothing serving behind it', async () => {
    const loopback = aLoopbackThatOpensSlowly();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    const starting = runtime.start(codex);
    const stopping = runtime.stop(codex.slug);

    loopback.finishOpening();
    await starting;
    await stopping;

    expect(loopback.serving).toEqual(new Set());
  });
});

describe('stopping a gateway', () => {
  test('a stopped gateway answers nowhere and reports stopped', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(codex);

    expect(await runtime.stop(codex.slug)).toEqual({ status: 'stopped' });
    expect(loopback.serving).toEqual(new Set());
  });

  test('stopping one of two leaves the other serving', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(codex);
    await runtime.start(gemini);
    await runtime.stop(codex.slug);

    expect(loopback.serving).toEqual(new Set([gemini.port]));
  });

  test('stopping a gateway nobody started reports stopped and changes nothing', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(gemini);

    expect(await runtime.stop(codex.slug)).toEqual({ status: 'stopped' });
    expect(loopback.serving).toEqual(new Set([gemini.port]));
  });

  test('a stopped gateway starts again on the port it released', async () => {
    const loopback = aLoopback();
    const runtime = createEngineRuntime(loopback.openListeners, grantsNothing);

    await runtime.start(codex);
    await runtime.stop(codex.slug);

    expect(await runtime.start(codex)).toEqual({ status: 'running' });
    expect(loopback.serving).toEqual(new Set([codex.port]));
  });
});

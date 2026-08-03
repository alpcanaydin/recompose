import { describe, expect, test, vi } from 'vitest';

import type { OpenListeners } from './engine-runtime';
import type { ParentPort } from './parent-port';

import { attachEngineChild } from './engine-child';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397 };

type Parent = {
  reports: unknown[];
  send: (directive: unknown) => void;
  port: ParentPort;
};

function aParent(): Parent {
  const reports: unknown[] = [];
  const handlers: ((messageEvent: { data: unknown }) => void)[] = [];

  return {
    reports,
    send: (directive) => {
      for (const handler of handlers) {
        handler({ data: directive });
      }
    },
    port: {
      postMessage: (message) => {
        reports.push(message);
      },
      on: (event: string, handler: (messageEvent: { data: unknown }) => void) => {
        if (event === 'message') {
          handlers.push(handler);
        }
      },
    },
  };
}

function aLoopbackHolding(heldPorts: readonly number[]): OpenListeners {
  return async (_app, port) =>
    Promise.resolve(
      heldPorts.includes(port)
        ? { failed: { port } }
        : { opened: { close: async () => Promise.resolve() } },
    );
}

async function reportsReach(parent: Parent, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(parent.reports).toHaveLength(count);
  });
}

describe('a directive the parent sends', () => {
  test('a start directive answers with a running report naming the gateway', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'start', id: 'd1', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', answers: 'd1', slug: 'codex', state: { status: 'running' } },
    ]);
  });

  test('a stop directive answers with a stopped report naming the gateway', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'start', id: 'd1', gateway: codex });
    await reportsReach(parent, 1);
    parent.send({ kind: 'stop', id: 'd2', slug: 'codex' });
    await reportsReach(parent, 2);

    expect(parent.reports[1]).toEqual({
      kind: 'state',
      answers: 'd2',
      slug: 'codex',
      state: { status: 'stopped' },
    });
  });

  test('a start whose port another process holds answers with the port it wanted', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([codex.port]));
    parent.send({ kind: 'start', id: 'd1', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      {
        kind: 'state',
        answers: 'd1',
        slug: 'codex',
        state: { status: 'stopped', failure: { port: 8397 } },
      },
    ]);
  });
});

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

function fetchAnswering(status: number): { urls: string[]; fetchLike: typeof fetch } {
  const urls: string[] = [];

  const fetchLike: typeof fetch = async (input) => {
    urls.push(urlOf(input));

    return Promise.resolve(new Response(null, { status }));
  };

  return { urls, fetchLike };
}

describe('a probe directive the parent sends', () => {
  test('a probe folds the vendor answer and reports it to the directive that asked', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchAnswering(200).fetchLike);
    parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'key-check', answers: 'd1', verdict: 'authenticates', status: 200 },
    ]);
  });

  test('a probe whose fetch throws still answers, saying the check could not run', async () => {
    const parent = aParent();
    const refusing: typeof fetch = async () => Promise.reject(new TypeError('fetch failed'));

    attachEngineChild(parent.port, aLoopbackHolding([]), refusing);
    parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'key-check', answers: 'd1', verdict: 'could-not-check' },
    ]);
  });

  test('the answer carries no window of the key it was handed', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchAnswering(200).fetchLike);
    parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
    await reportsReach(parent, 1);

    expect(JSON.stringify(parent.reports)).not.toContain('9f2c');
  });
});

describe('the origin a probe reaches', () => {
  test('each vendor is probed at its own first-party host by default', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);

    attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
    parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
    parent.send({ kind: 'probe', id: 'd2', provider: 'openai', key: 'sk-proj-fake-openai-paste' });
    await reportsReach(parent, 2);

    expect(urls).toEqual([
      'https://api.anthropic.com/v1/models',
      'https://api.openai.com/v1/models',
    ]);
  });

  test('the environment substitutes the probe origin for every vendor', async () => {
    const parent = aParent();
    const { urls, fetchLike } = fetchAnswering(200);

    vi.stubEnv('RECOMPOSE_PROBE_ORIGIN', 'http://127.0.0.1:8642');

    try {
      attachEngineChild(parent.port, aLoopbackHolding([]), fetchLike);
      parent.send({ kind: 'probe', id: 'd1', provider: 'anthropic', key: 'sk-ant-api03-9f2c' });
      parent.send({
        kind: 'probe',
        id: 'd2',
        provider: 'openai',
        key: 'sk-proj-fake-openai-paste',
      });
      await reportsReach(parent, 2);

      expect(urls).toEqual(['http://127.0.0.1:8642/v1/models', 'http://127.0.0.1:8642/v1/models']);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('a directive the child cannot read', () => {
  test('a directive of an unknown kind draws no report at all', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'launch', id: 'd0', gateway: codex });
    parent.send({ kind: 'start', id: 'd1', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', answers: 'd1', slug: 'codex', state: { status: 'running' } },
    ]);
  });

  test('a gateway named after a Windows device draws no report either', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'start', id: 'd0', gateway: { ...codex, slug: 'con' } });
    parent.send({ kind: 'start', id: 'd1', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', answers: 'd1', slug: 'codex', state: { status: 'running' } },
    ]);
  });

  test('an unreadable directive is logged rather than swallowed', () => {
    const parent = aParent();
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ nonsense: true });

    expect(complaints).toHaveBeenCalledWith(
      expect.stringContaining('could not read'),
      expect.anything(),
    );
    complaints.mockRestore();
  });
});

describe('the refusal log a malformed directive draws', () => {
  test('it names issue paths and codes, never what the directive carried', () => {
    const parent = aParent();
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({
      kind: 'probe',
      id: 'd1',
      provider: 'anthropic',
      key: 'sk-hidden-77aa',
      'sk-marker-2b7e1a90': true,
    });
    parent.send({ kind: 'start', id: 'd2', gateway: { ...codex, port: 'sk-hidden-77aa' } });

    const spoken = JSON.stringify(complaints.mock.calls);

    expect(spoken).toContain('unrecognized_keys');
    expect(spoken).toContain('gateway.port');
    expect(spoken).not.toContain('sk-marker-2b7e1a90');
    expect(spoken).not.toContain('sk-hidden-77aa');
    complaints.mockRestore();
  });
});

describe('a directive whose work fails', () => {
  test('the failure is logged rather than swallowed, and no report goes back', async () => {
    const parent = aParent();
    const failing: OpenListeners = async () =>
      Promise.reject(new Error('the listener could not open'));
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    attachEngineChild(parent.port, failing);
    parent.send({ kind: 'start', id: 'd1', gateway: codex });

    await vi.waitFor(() => {
      expect(complaints).toHaveBeenCalledWith(
        expect.stringContaining('could not answer'),
        expect.anything(),
      );
    });

    expect(parent.reports).toEqual([]);
    complaints.mockRestore();
  });
});

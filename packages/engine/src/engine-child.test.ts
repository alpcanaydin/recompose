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
    parent.send({ kind: 'start', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', slug: 'codex', state: { status: 'running' } },
    ]);
  });

  test('a stop directive answers with a stopped report naming the gateway', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'start', gateway: codex });
    await reportsReach(parent, 1);
    parent.send({ kind: 'stop', slug: 'codex' });
    await reportsReach(parent, 2);

    expect(parent.reports[1]).toEqual({
      kind: 'state',
      slug: 'codex',
      state: { status: 'stopped' },
    });
  });

  test('a start whose port another process holds answers with the port it wanted', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([codex.port]));
    parent.send({ kind: 'start', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', slug: 'codex', state: { status: 'stopped', failure: { port: 8397 } } },
    ]);
  });
});

describe('a directive the child cannot read', () => {
  test('a directive of an unknown kind draws no report at all', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'launch', gateway: codex });
    parent.send({ kind: 'start', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', slug: 'codex', state: { status: 'running' } },
    ]);
  });

  test('a gateway named after a Windows device draws no report either', async () => {
    const parent = aParent();

    attachEngineChild(parent.port, aLoopbackHolding([]));
    parent.send({ kind: 'start', gateway: { ...codex, slug: 'con' } });
    parent.send({ kind: 'start', gateway: codex });
    await reportsReach(parent, 1);

    expect(parent.reports).toEqual([
      { kind: 'state', slug: 'codex', state: { status: 'running' } },
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

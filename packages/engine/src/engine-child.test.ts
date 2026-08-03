import { describe, expect, test, vi } from 'vitest';

import type { OpenListeners } from './engine-runtime';

import { attachEngineChild } from './engine-child';
import { aLoopbackHolding, aParent, fetchAnswering, reportsReach } from './engine-child.testkit';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397 };

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

import { type EngineGateway } from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createEngineHost, PROBE_TIMEOUT_MS } from './engine-host';
import { hostOver, nothing, running, scriptedChild } from './engine-host.testkit';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };
const key = 'sk-ant-api03-long-secret-7f2c';
const childFetchBoundMs = 10_000;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what a probe answers', () => {
  test('a key the vendor accepts answers authenticates beside its status', async () => {
    const { host } = hostOver(
      scriptedChild(nothing, () => ({ verdict: 'authenticates', status: 200 })),
    );

    await expect(host.probe('anthropic', key)).resolves.toEqual({
      verdict: 'authenticates',
      status: 200,
    });
  });

  test('a key the vendor turns away answers not-accepted', async () => {
    const { host } = hostOver(
      scriptedChild(nothing, () => ({ verdict: 'not-accepted', status: 401 })),
    );

    await expect(host.probe('openai', key)).resolves.toEqual({
      verdict: 'not-accepted',
      status: 401,
    });
  });

  test('a report carrying no status answers without one', async () => {
    const { host } = hostOver(scriptedChild(nothing, () => ({ verdict: 'could-not-check' })));

    await expect(host.probe('anthropic', key)).resolves.toStrictEqual({
      verdict: 'could-not-check',
    });
  });

  test('the key travels to the child in the probe directive alone', async () => {
    const scripted = scriptedChild(nothing, () => ({ verdict: 'authenticates', status: 200 }));
    const { host } = hostOver(scripted);

    await host.probe('anthropic', key);

    expect(scripted.directives).toMatchObject([{ kind: 'probe', provider: 'anthropic', key }]);
  });
});

describe('a probe beside a gateway directive', () => {
  test('each report reaches the caller that asked, routed by kind', async () => {
    const scripted = scriptedChild(running, () => ({ verdict: 'not-accepted', status: 403 }));
    const { host } = hostOver(scripted, ['codex']);

    const [started, checked] = await Promise.all([host.start(codex), host.probe('anthropic', key)]);

    expect(started).toEqual({ status: 'running' });
    expect(checked).toEqual({ verdict: 'not-accepted', status: 403 });
    expect(host.states()).toEqual({ codex: { status: 'running' } });
  });

  test('a key-check report nobody waits on is written down rather than passed over', () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted, ['codex']);

    void host.probe('anthropic', key);
    scripted.send({ kind: 'key-check', answers: 'ghost', verdict: 'authenticates' });

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('key-check');
  });
});

describe('a probe standing when the child dies', () => {
  test('a dead child folds a waiting probe to could-not-check', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const checking = host.probe('anthropic', key);

    await Promise.resolve();
    scripted.exit(1);

    await expect(checking).resolves.toEqual({ verdict: 'could-not-check' });
  });

  test('the dead-child fold logs a line naming the provider and never the key', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const checking = host.probe('anthropic', key);

    await Promise.resolve();
    scripted.exit(1);
    await checking;

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('anthropic');
    expect(spoken).not.toContain(key);
  });
});

describe('a probe that never draws an answer', () => {
  test('a probe nobody answers folds to could-not-check once the host stops waiting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const checking = host.probe('anthropic', key);

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

    await expect(checking).resolves.toEqual({ verdict: 'could-not-check' });
  });

  test('the timeout fold logs a line naming the provider and never the key', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const checking = host.probe('openai', key);

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    await checking;

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('openai');
    expect(spoken).not.toContain(key);
  });

  test('a child that will not spawn folds to could-not-check rather than throwing', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createEngineHost({
      knownSlugs: [],
      spawnChild: () => {
        throw new Error('the engine bundle is missing');
      },
    });

    await expect(host.probe('anthropic', key)).resolves.toEqual({ verdict: 'could-not-check' });

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('anthropic');
    expect(spoken).not.toContain(key);
  });
});

describe('a reading nobody asked for', () => {
  test('a runtime reading arriving unasked is complained about rather than folded into a gateway', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted, [codex.slug]);

    await host.start(codex);

    scripted.send({
      kind: 'runtime-check',
      answers: 'nobody',
      reachability: { verdict: 'answers', version: '0.5.1' },
    });

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('runtime');
    expect(spoken).not.toContain('undefined');
    expect(host.states()[codex.slug]).toEqual({ status: 'running' });
  });
});

describe('the two wait bounds', () => {
  test('the host waits on a probe longer than the child waits on its fetch', () => {
    expect(PROBE_TIMEOUT_MS).toBeGreaterThan(childFetchBoundMs);
  });
});

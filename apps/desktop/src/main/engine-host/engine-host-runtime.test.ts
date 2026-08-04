import { fc, test } from '@fast-check/vitest';
import { localRuntimeAddresses, type RuntimeReachability } from '@recompose/contracts';
import { afterEach, describe, expect, vi } from 'vitest';

import { createEngineHost, PROBE_TIMEOUT_MS } from './engine-host';
import { hostOver, nothing, scriptedChild } from './engine-host.testkit';

const ollama = localRuntimeAddresses.ollama;
const key = 'sk-ant-api03-long-secret-7f2c';
const runtimeFetchBoundMs = 3000;
const answering = (): RuntimeReachability => ({ verdict: 'answers', version: '0.5.1' });

const anyReading = fc.oneof(
  fc
    .constantFrom('0.5.1', '0.12.0', '1.0.0')
    .map((version): RuntimeReachability => ({ verdict: 'answers', version })),
  fc
    .integer({ min: 100, max: 599 })
    .map((status): RuntimeReachability => ({ verdict: 'unrecognized', status })),
  fc.constant<RuntimeReachability>({ verdict: 'unreachable' }),
);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what a look at a runtime answers', () => {
  test('a runtime that names its version answers with the version it named', async () => {
    const { host } = hostOver(scriptedChild(nothing, nothing, answering));

    await expect(host.probeRuntime(ollama)).resolves.toEqual({
      verdict: 'answers',
      version: '0.5.1',
    });
  });

  test('the address travels to the child in the probe-runtime directive alone', async () => {
    const scripted = scriptedChild(nothing, nothing, answering);
    const { host } = hostOver(scripted);

    await host.probeRuntime(ollama);

    expect(scripted.directives).toMatchObject([{ kind: 'probe-runtime', address: ollama }]);
  });

  test.prop([anyReading])(
    'every reading the child sends reaches the caller unchanged',
    async (reading) => {
      const { host } = hostOver(scriptedChild(nothing, nothing, () => reading));

      await expect(host.probeRuntime(ollama)).resolves.toStrictEqual(reading);
    },
  );
});

describe('a runtime look beside a key probe', () => {
  test('each report reaches the caller that asked, routed by kind', async () => {
    const scripted = scriptedChild(
      nothing,
      () => ({ verdict: 'not-accepted', status: 401 }),
      answering,
    );
    const { host } = hostOver(scripted);

    const [checked, looked] = await Promise.all([
      host.probe('anthropic', key),
      host.probeRuntime(ollama),
    ]);

    expect(checked).toEqual({ verdict: 'not-accepted', status: 401 });
    expect(looked).toEqual({ verdict: 'answers', version: '0.5.1' });
  });
});

describe('a runtime look standing when the child dies', () => {
  test('a dead child folds a waiting look to unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const looking = host.probeRuntime(ollama);

    await Promise.resolve();
    scripted.exit(1);

    await expect(looking).resolves.toEqual({ verdict: 'unreachable' });
  });

  test('the dead-child fold logs a line naming the runtime and the address it looked at', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const looking = host.probeRuntime(ollama);

    await Promise.resolve();
    scripted.exit(1);
    await looking;

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('runtime');
    expect(spoken).toContain(ollama);
  });

  test('a key probe and a runtime look fold beside each other, and no line carries the key', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const both = Promise.all([host.probe('anthropic', key), host.probeRuntime(ollama)]);

    await Promise.resolve();
    scripted.exit(1);

    await expect(both).resolves.toEqual([
      { verdict: 'could-not-check' },
      { verdict: 'unreachable' },
    ]);

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('anthropic');
    expect(spoken).toContain(ollama);
    expect(spoken).not.toContain(key);
  });
});

describe('a runtime look that never draws an answer', () => {
  test('a look nobody answers folds to unreachable once the host stops waiting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const looking = host.probeRuntime(ollama);

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

    await expect(looking).resolves.toEqual({ verdict: 'unreachable' });
  });

  test('the timeout fold logs a line naming the address it gave up on', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const looking = host.probeRuntime(ollama);

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    await looking;

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain(ollama);
  });

  test('a child that will not spawn folds the look to unreachable rather than throwing', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createEngineHost({
      knownSlugs: [],
      spawnChild: () => {
        throw new Error('the engine bundle is missing');
      },
    });

    await expect(host.probeRuntime(ollama)).resolves.toEqual({ verdict: 'unreachable' });

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain(ollama);
  });
});

describe('the runtime wait bound', () => {
  test('the host waits on a runtime look longer than the child waits on its runtime fetch', () => {
    expect(PROBE_TIMEOUT_MS).toBeGreaterThan(runtimeFetchBoundMs);
  });
});

import { modelListBoundMs, type EngineGateway, type ModelListing } from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createEngineHost, PROBE_TIMEOUT_MS } from './engine-host';
import { grantsNothing, hostOver, nothing, running, scriptedChild } from './engine-host.testkit';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };
const vendorOrigin = 'https://api.openai.com';
const credential = 'sk-ant-api03-long-secret-7f2c';
const credentialed = { custody: 'bearer', provider: 'openrouter', credential } as const;
const open = { custody: 'open' } as const;

const listing: ModelListing = { standing: 'listed', modelIds: ['gpt-5'] };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what a model-list look answers', () => {
  test('the ids the child read come back to the caller that asked', async () => {
    const { host } = hostOver(scriptedChild(nothing, undefined, undefined, () => listing));

    await expect(host.listModels(vendorOrigin, credentialed)).resolves.toEqual(listing);
  });

  test('a child that read nothing answers unlisted', async () => {
    const { host } = hostOver(
      scriptedChild(nothing, undefined, undefined, () => ({ standing: 'unlisted' })),
    );

    await expect(host.listModels(vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });
  });

  test('the credential travels to the child in the look directive alone', async () => {
    const scripted = scriptedChild(nothing, undefined, undefined, () => listing);
    const { host } = hostOver(scripted);

    await host.listModels(vendorOrigin, credentialed);

    expect(scripted.directives).toMatchObject([
      { kind: 'list-models', origin: vendorOrigin, custody: credentialed },
    ]);
    expect(scripted.directives).toHaveLength(1);
  });

  test('an open account travels with no credential to leak', async () => {
    const scripted = scriptedChild(nothing, undefined, undefined, () => listing);
    const { host } = hostOver(scripted);

    await host.listModels('http://127.0.0.1:11434', open);

    expect(JSON.stringify(scripted.directives)).not.toContain('7f2c');
  });
});

describe('a look beside a gateway directive', () => {
  test('each answer reaches the caller that asked, routed by kind', async () => {
    const scripted = scriptedChild(running, undefined, undefined, () => listing);
    const { host } = hostOver(scripted, ['codex']);

    const [started, listed] = await Promise.all([
      host.start(codex),
      host.listModels(vendorOrigin, credentialed),
    ]);

    expect(started).toEqual({ status: 'running' });
    expect(listed).toEqual(listing);
    expect(host.states()).toEqual({ codex: { status: 'running' } });
  });

  test('a model list nobody waits on is written down rather than passed over', () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted, ['codex']);

    void host.listModels(vendorOrigin, credentialed);
    scripted.send({ kind: 'model-list', answers: 'ghost', listing });

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('model list');
  });
});

describe('a look standing when the child dies', () => {
  test('a dead child folds a waiting look to unlisted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const looking = host.listModels(vendorOrigin, credentialed);

    await Promise.resolve();
    scripted.exit(1);

    await expect(looking).resolves.toEqual({ standing: 'unlisted' });
  });

  test('the dead-child fold names the origin and never the credential', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const looking = host.listModels(vendorOrigin, credentialed);

    await Promise.resolve();
    scripted.exit(1);
    await looking;

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain(vendorOrigin);
    expect(spoken).not.toContain('7f2c');
  });
});

describe('a look that never draws an answer', () => {
  test('a look nobody answers folds to unlisted once the host stops waiting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const looking = host.listModels(vendorOrigin, credentialed);

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

    await expect(looking).resolves.toEqual({ standing: 'unlisted' });
  });

  test('the timeout fold names the origin and never the credential', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const looking = host.listModels(vendorOrigin, credentialed);

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    await looking;

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain(vendorOrigin);
    expect(spoken).not.toContain('7f2c');
  });

  test('a child that will not spawn folds to unlisted rather than throwing', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const host = createEngineHost({
      knownSlugs: [],
      grantFor: grantsNothing,
      spawnChild: () => {
        throw new Error('the engine bundle is missing');
      },
    });

    await expect(host.listModels(vendorOrigin, credentialed)).resolves.toEqual({
      standing: 'unlisted',
    });

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain(vendorOrigin);
    expect(spoken).not.toContain('7f2c');
  });
});

describe('the two wait bounds', () => {
  test('the host waits on a look longer than the child waits on its fetch', () => {
    expect(PROBE_TIMEOUT_MS).toBeGreaterThan(modelListBoundMs);
  });
});

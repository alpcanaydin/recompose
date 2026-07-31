import {
  type EngineDirective,
  type EngineGateway,
  type EngineStates,
  type GatewayEngineState,
} from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { EngineChild } from './engine-host';

import { createEngineHost, DIRECTIVE_TIMEOUT_MS } from './engine-host';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397 };

type Answer = (directive: EngineDirective) => GatewayEngineState | null;

function scriptedChild(answer: Answer) {
  const directives: EngineDirective[] = [];
  const heard: ((message: unknown) => void)[] = [];

  const send = (report: unknown): void => {
    for (const listener of heard) {
      listener(report);
    }
  };

  const child: EngineChild = {
    postMessage: (directive) => {
      directives.push(directive);

      const slug = directive.kind === 'start' ? directive.gateway.slug : directive.slug;

      void Promise.resolve().then(() => {
        const state = answer(directive);

        if (state !== null) {
          send({ kind: 'state', answers: directive.id, slug, state });
        }
      });
    },
    onMessage: (listener) => {
      heard.push(listener);
    },
    onExit: () => undefined,
    kill: () => undefined,
  };

  return { child, directives, send };
}

function hostOver(scripted: { child: EngineChild }, knownSlugs: readonly string[] = []) {
  return { host: createEngineHost({ knownSlugs, spawnChild: () => scripted.child }) };
}

const asAsked: Answer = (directive) =>
  directive.kind === 'start' ? { status: 'running' } : { status: 'stopped' };

const silentOnStop: Answer = (directive) =>
  directive.kind === 'start' ? { status: 'running' } : null;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what the engine host answers a lifecycle request', () => {
  test('a started gateway answers running', async () => {
    const { host } = hostOver(scriptedChild(asAsked));

    await expect(host.start(codex)).resolves.toEqual({ status: 'running' });
  });

  test('a stopped gateway answers stopped', async () => {
    const { host } = hostOver(scriptedChild(asAsked));

    await expect(host.stop('codex')).resolves.toEqual({ status: 'stopped' });
  });

  test('a gateway whose port another process holds answers stopped beside that port', async () => {
    const { host } = hostOver(
      scriptedChild(() => ({ status: 'stopped', failure: { port: 8397 } })),
    );

    await expect(host.start(codex)).resolves.toEqual({
      status: 'stopped',
      failure: { port: 8397 },
    });
  });

  test('a restart leaves the gateway running, having stopped it first', async () => {
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted);

    await host.start(codex);

    await expect(host.restart(codex)).resolves.toEqual({ status: 'running' });
    expect(scripted.directives.map((directive) => directive.kind)).toEqual([
      'start',
      'stop',
      'start',
    ]);
  });

  test('a restart whose stop is never reported still starts the gateway', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(silentOnStop));

    const restarting = host.restart(codex);

    await vi.advanceTimersByTimeAsync(DIRECTIVE_TIMEOUT_MS);

    await expect(restarting).resolves.toEqual({ status: 'running' });
  });

  test('a stop that goes unreported is written down rather than passed over', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(silentOnStop));

    const restarting = host.restart(codex);

    await vi.advanceTimersByTimeAsync(DIRECTIVE_TIMEOUT_MS);
    await restarting;

    expect(String(complaint.mock.calls[0]?.[0])).toContain('codex');
  });
});

describe('the ledger the engine host keeps', () => {
  test('every stored gateway reads stopped before anything starts', () => {
    const { host } = hostOver(scriptedChild(asAsked), ['codex', 'gemini']);

    expect(host.states()).toEqual({
      codex: { status: 'stopped' },
      gemini: { status: 'stopped' },
    });
  });

  test('a started gateway reads running while its sibling stays where it stood', async () => {
    const { host } = hostOver(scriptedChild(asAsked), ['codex', 'gemini']);

    await host.start(codex);

    expect(host.states()).toEqual({
      codex: { status: 'running' },
      gemini: { status: 'stopped' },
    });
  });

  test('the ledger already carries the answer by the time the start resolves', async () => {
    const { host } = hostOver(scriptedChild(asAsked), ['codex']);

    const state = await host.start(codex);

    expect(host.states()['codex']).toEqual(state);
  });
});

describe('reports the engine host did not ask for', () => {
  test('a report answering a directive nobody waits on any more leaves the ledger alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', answers: 'd404', slug: 'codex', state: { status: 'stopped' } });

    expect(host.states()).toEqual({ codex: { status: 'running' } });
  });

  test('a report nobody waits on is written down rather than passed over in silence', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', answers: 'd404', slug: 'codex', state: { status: 'stopped' } });

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('codex');
  });

  test('a report the schema rejects leaves the ledger alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', answers: 'd1', slug: 'codex', state: { status: 'nonsense' } });

    expect(host.states()).toEqual({ codex: { status: 'running' } });
  });

  test('a report the schema rejects is written down rather than swallowed', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', answers: 'd1', slug: 'codex', state: { status: 'nonsense' } });

    expect(complaint.mock.calls.flat().map(String).join(' ')).toContain('engine');
  });
});

describe('quitting before the engine ever ran', () => {
  test('disposing without a child is quiet, because a start may never have happened', () => {
    const { host } = hostOver(scriptedChild(asAsked), ['codex']);

    expect(() => {
      host.dispose();
    }).not.toThrow();
  });
});

describe('who hears the ledger change', () => {
  test('a subscriber hears the snapshot every change produces', async () => {
    const { host } = hostOver(scriptedChild(asAsked), ['codex']);
    const heard: EngineStates[] = [];

    host.onStatesChanged((states) => {
      heard.push(states);
    });

    await host.start(codex);
    await host.stop('codex');

    expect(heard).toEqual([{ codex: { status: 'running' } }, { codex: { status: 'stopped' } }]);
  });

  test('a subscriber that let go hears nothing more', async () => {
    const { host } = hostOver(scriptedChild(asAsked), ['codex']);
    const heard: EngineStates[] = [];

    const letGo = host.onStatesChanged((states) => {
      heard.push(states);
    });

    await host.start(codex);
    letGo();
    await host.stop('codex');

    expect(heard).toEqual([{ codex: { status: 'running' } }]);
  });
});

describe('when the engine child will not spawn at all', () => {
  test('the failure carries out rather than leaving the caller waiting', async () => {
    const host = createEngineHost({
      knownSlugs: [],
      spawnChild: () => {
        throw new Error('the engine bundle is missing');
      },
    });

    await expect(host.start(codex)).rejects.toThrow('the engine bundle is missing');
  });
});

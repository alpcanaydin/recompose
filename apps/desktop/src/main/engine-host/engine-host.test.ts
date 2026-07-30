import {
  type EngineDirective,
  type EngineGateway,
  type EngineStates,
  type GatewayEngineState,
} from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { EngineChild } from './engine-host';

import { createEngineHost } from './engine-host';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397 };

type Answer = (directive: EngineDirective) => GatewayEngineState;

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
        send({ kind: 'state', slug, state: answer(directive) });
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

afterEach(() => {
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
  test('a report naming a gateway nobody asked about still lands in the ledger', async () => {
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', slug: 'gemini', state: { status: 'running' } });

    expect(host.states()['gemini']).toEqual({ status: 'running' });
  });

  test('a report the schema rejects leaves the ledger alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', slug: 'codex', state: { status: 'nonsense' } });

    expect(host.states()).toEqual({ codex: { status: 'running' } });
  });

  test('a report the schema rejects is written down rather than swallowed', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(asAsked);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.send({ kind: 'state', slug: 'codex', state: { status: 'nonsense' } });

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

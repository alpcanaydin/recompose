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
const gemini: EngineGateway = { slug: 'gemini', displayName: 'Gemini', port: 8398 };

const running = (): GatewayEngineState => ({ status: 'running' });
const nothing = (): null => null;

function scriptedChild(answer: () => GatewayEngineState | null) {
  const directives: EngineDirective[] = [];
  const heard: ((message: unknown) => void)[] = [];
  const departed: ((code: number) => void)[] = [];
  let killed = false;

  const send = (report: unknown): void => {
    for (const listener of heard) {
      listener(report);
    }
  };

  const child: EngineChild = {
    postMessage: (directive) => {
      directives.push(directive);

      const state = answer();

      if (state === null) {
        return;
      }

      const slug = directive.kind === 'start' ? directive.gateway.slug : directive.slug;

      void Promise.resolve().then(() => {
        send({ kind: 'state', slug, state });
      });
    },
    onMessage: (listener) => {
      heard.push(listener);
    },
    onExit: (listener) => {
      departed.push(listener);
    },
    kill: () => {
      killed = true;
    },
  };

  return {
    child,
    directives,
    send,
    wasKilled: () => killed,
    exit: (code: number) => {
      for (const listener of departed) {
        listener(code);
      }
    },
  };
}

function hostOver(scripted: { child: EngineChild }, knownSlugs: readonly string[] = []) {
  const spawns: number[] = [];

  return {
    spawns,
    host: createEngineHost({
      knownSlugs,
      spawnChild: () => {
        spawns.push(spawns.length);

        return scripted.child;
      },
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('one engine child, kept across every directive', () => {
  test('no gateway lifecycle request means no engine process at all', () => {
    const { host, spawns } = hostOver(scriptedChild(running), ['codex']);

    expect(host.states()).toEqual({ codex: { status: 'stopped' } });
    expect(spawns).toEqual([]);
  });

  test('a second directive reuses the child the first one spawned', async () => {
    const { host, spawns } = hostOver(scriptedChild(running));

    await host.start(codex);
    await host.start(gemini);

    expect(spawns).toEqual([0]);
  });

  test('quitting kills the engine child, so no gateway outlives the app on its port', async () => {
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted);

    await host.start(codex);
    host.dispose();

    expect(scripted.wasKilled()).toBe(true);
  });
});

describe('the order directives reach the engine child in', () => {
  test('two directives naming one gateway reach the child one after the other', async () => {
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const starting = host.start(codex);
    const stopping = host.stop('codex');

    await Promise.resolve();
    expect(scripted.directives).toEqual([{ kind: 'start', gateway: codex }]);

    scripted.send({ kind: 'state', slug: 'codex', state: { status: 'running' } });
    await starting;
    await Promise.resolve();

    expect(scripted.directives.at(-1)).toEqual({ kind: 'stop', slug: 'codex' });

    scripted.send({ kind: 'state', slug: 'codex', state: { status: 'stopped' } });
    await expect(stopping).resolves.toEqual({ status: 'stopped' });
  });

  test('directives naming different gateways travel together', async () => {
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    void host.start(codex);
    void host.start(gemini);

    await Promise.resolve();

    expect(scripted.directives).toEqual([
      { kind: 'start', gateway: codex },
      { kind: 'start', gateway: gemini },
    ]);
  });
});

describe('when the engine child dies on its own', () => {
  test('every gateway reads stopped and the subscribers hear it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted, ['codex', 'gemini']);
    const heard: EngineStates[] = [];

    await host.start(codex);
    await host.start(gemini);
    host.onStatesChanged((states) => {
      heard.push(states);
    });
    scripted.exit(1);

    expect(host.states()).toEqual({
      codex: { status: 'stopped' },
      gemini: { status: 'stopped' },
    });
    expect(heard).toEqual([{ codex: { status: 'stopped' }, gemini: { status: 'stopped' } }]);
  });

  test('the exit is written down rather than swallowed', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.exit(9);

    expect(complaint.mock.calls.flat().join(' ')).toContain('9');
  });

  test('a directive still waiting settles on stopped rather than hanging', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted, ['codex']);

    const starting = host.start(codex);

    await Promise.resolve();
    scripted.exit(1);

    await expect(starting).resolves.toEqual({ status: 'stopped' });
  });

  test('the next start spawns a fresh child', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(running);
    const { host, spawns } = hostOver(scripted, ['codex']);

    await host.start(codex);
    scripted.exit(1);
    await host.start(codex);

    expect(spawns).toEqual([0, 1]);
  });
});

describe('when the engine child answers nothing at all', () => {
  test('a directive fails once its wait runs out, naming the gateway', async () => {
    vi.useFakeTimers();
    const { host } = hostOver(scriptedChild(nothing));

    const settled = host.start(codex).catch((error: unknown) => String(error));

    await vi.advanceTimersByTimeAsync(DIRECTIVE_TIMEOUT_MS);

    await expect(settled).resolves.toContain('codex');
  });

  test('a directive answered on the last tick before the wait runs out still succeeds', async () => {
    vi.useFakeTimers();
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const starting = host.start(codex);

    await vi.advanceTimersByTimeAsync(DIRECTIVE_TIMEOUT_MS - 1);
    scripted.send({ kind: 'state', slug: 'codex', state: { status: 'running' } });

    await expect(starting).resolves.toEqual({ status: 'running' });
  });

  test('a gateway that timed out can still be asked again', async () => {
    vi.useFakeTimers();
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    const first = host.start(codex).catch(() => 'refused');

    await vi.advanceTimersByTimeAsync(DIRECTIVE_TIMEOUT_MS);
    await first;

    const second = host.start(codex);

    await vi.advanceTimersByTimeAsync(0);
    scripted.send({ kind: 'state', slug: 'codex', state: { status: 'running' } });

    await expect(second).resolves.toEqual({ status: 'running' });
  });
});

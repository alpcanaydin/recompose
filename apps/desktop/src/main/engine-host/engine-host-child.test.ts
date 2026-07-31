import { type EngineGateway, type EngineStates } from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { hostOver, nothing, running, scriptedChild } from './engine-host.testkit';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397 };
const gemini: EngineGateway = { slug: 'gemini', displayName: 'Gemini', port: 8398 };

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
    expect(scripted.directives).toMatchObject([{ kind: 'start', gateway: codex }]);

    scripted.answerDirective(0, { status: 'running' });
    await starting;
    await Promise.resolve();

    expect(scripted.directives.at(-1)).toMatchObject({ kind: 'stop', slug: 'codex' });

    scripted.answerDirective(1, { status: 'stopped' });
    await expect(stopping).resolves.toEqual({ status: 'stopped' });
  });

  test('directives naming different gateways travel together', async () => {
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted);

    void host.start(codex);
    void host.start(gemini);

    await Promise.resolve();

    expect(scripted.directives).toMatchObject([
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

  test('a directive still waiting fails naming the exit, rather than reading as a clean stop', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted, ['codex']);

    const starting = host.start(codex);

    await Promise.resolve();
    scripted.exit(1);

    await expect(starting).rejects.toThrow('exit code 1');
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

describe('when the engine child cannot load at all', () => {
  test('every start fails rather than answering, however often it is asked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted, ['codex']);

    const starting = host.start(codex);

    await Promise.resolve();
    scripted.exit(1);
    await expect(starting).rejects.toThrow();

    const again = host.start(codex);

    await Promise.resolve();
    scripted.exit(1);

    await expect(again).rejects.toThrow('exit code 1');
  });
});

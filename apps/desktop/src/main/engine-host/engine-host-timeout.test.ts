import { type EngineGateway } from '@recompose/contracts';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { DIRECTIVE_TIMEOUT_MS } from './engine-host';
import { hostOver, nothing, scriptedChild } from './engine-host.testkit';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    scripted.answerDirective(0, { status: 'running' });

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
    scripted.answerDirective(1, { status: 'running' });

    await expect(second).resolves.toEqual({ status: 'running' });
  });

  test('the report a given-up directive draws at last answers nobody', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const scripted = scriptedChild(nothing);
    const { host } = hostOver(scripted, ['codex']);

    const abandoned = host.start(codex).catch(() => 'given up');

    await vi.advanceTimersByTimeAsync(DIRECTIVE_TIMEOUT_MS);
    await abandoned;

    const stopping = host.stop('codex');

    await vi.advanceTimersByTimeAsync(0);
    scripted.answerDirective(0, { status: 'running' });

    expect(host.states()).toEqual({ codex: { status: 'stopped' } });

    scripted.answerDirective(1, { status: 'stopped' });

    await expect(stopping).resolves.toEqual({ status: 'stopped' });
  });
});

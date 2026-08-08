import type { EngineGateway } from '@recompose/contracts';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { createEngineHost } from './engine-host';
import { grantsNothing, hostOver, running, scriptedChild } from './engine-host.testkit';
import { serveRewrittenGateway, startStoredGateway } from './stored-gateway-serving';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };

const movedCodex: EngineGateway = { ...codex, port: 8399 };

function hostWithoutAnEngine() {
  return createEngineHost({
    knownSlugs: ['codex'],
    grantFor: grantsNothing,
    spawnChild: () => {
      throw new Error('the engine bundle is missing');
    },
  });
}

function spokenIn(calls: readonly unknown[][]): string {
  return calls.flat().map(String).join(' ');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a gateway recompose has just stored', () => {
  test('the stored gateway is serving without anybody having asked for it', async () => {
    const { host } = hostOver(scriptedChild(running), ['codex']);

    startStoredGateway(host)(codex);

    await vi.waitFor(() => {
      expect(host.states()).toEqual({ codex: { status: 'running' } });
    });
  });

  test('a stored gateway that never came up is written down naming the gateway', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    startStoredGateway(hostWithoutAnEngine())(codex);

    await vi.waitFor(() => {
      expect(spokenIn(complaint.mock.calls)).toContain('stored codex');
    });
  });
});

describe('a gateway recompose has just rewritten', () => {
  test('the gateway serves the document it was rewritten to', async () => {
    const scripted = scriptedChild(running);
    const { host } = hostOver(scripted, ['codex']);

    await host.start(codex);
    serveRewrittenGateway(host)(movedCodex);

    await vi.waitFor(() => {
      expect(scripted.directives.at(-1)).toMatchObject({ kind: 'start', gateway: movedCodex });
    });
  });

  test('a rewrite that never came up again is written down naming the gateway', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    serveRewrittenGateway(hostWithoutAnEngine())(codex);

    await vi.waitFor(() => {
      expect(spokenIn(complaint.mock.calls)).toContain('rewrote codex');
    });
  });
});

import { expect, test, vi } from 'vitest';

import type { EngineChild } from './engine-host';

import { createEngineHost } from './engine-host';

function credentialChild(
  posted: unknown[],
  listeners: ((message: unknown) => void)[],
): EngineChild {
  return {
    postMessage: (message) => {
      posted.push(message);

      if (message.kind === 'start') {
        queueMicrotask(() => {
          for (const listener of listeners) {
            listener({
              kind: 'state',
              answers: message.id,
              slug: message.gateway.slug,
              state: { status: 'running' },
            });
          }
        });
      }
    },
    onMessage: (listener) => {
      listeners.push(listener);
    },
    onExit: () => undefined,
    kill: () => undefined,
  };
}

test('main durably stores a child credential update before acknowledging it', async () => {
  const posted: unknown[] = [];
  const listeners: ((message: unknown) => void)[] = [];
  const child = credentialChild(posted, listeners);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = vi.fn(async () => {
    await held;
  });
  const host = createEngineHost({
    knownSlugs: [],
    spawnChild: () => child,
    grantFor: async () => {
      await Promise.resolve();

      return { verdict: 'missing-target' };
    },
    storeSubscriptionCredential: store,
  });

  await host.start({ slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] });

  for (const listener of listeners) {
    listener({
      kind: 'subscription-credential-update',
      id: 'u1',
      provider: 'openai',
      accountId: 'acc-codex',
      credential: 'rotated-blob',
    });
  }

  await vi.waitFor(() => {
    expect(store).toHaveBeenCalledOnce();
  });

  expect(posted).not.toContainEqual(
    expect.objectContaining({ kind: 'subscription-credential-updated' }),
  );

  if (release !== undefined) {
    release();
  }

  await vi.waitFor(() => {
    expect(posted).toContainEqual({
      kind: 'subscription-credential-updated',
      answers: 'u1',
      verdict: 'stored',
    });
  });
  expect(store).toHaveBeenCalledWith('openai', 'acc-codex', 'rotated-blob');
});

import type { EngineGateway } from '@recompose/contracts';

import { afterEach, expect, test, vi } from 'vitest';

import type { EngineChild, EngineHostDeps } from './engine-host';

import { createEngineHost } from './engine-host';
import { grantsNothing } from './engine-host.testkit';

const codex: EngineGateway = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };

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

type CredentialLane = {
  posted: unknown[];
  listeners: ((message: unknown) => void)[];
  spawnChild: () => EngineChild;
};

function credentialLane(): CredentialLane {
  const posted: unknown[] = [];
  const listeners: ((message: unknown) => void)[] = [];
  const child = credentialChild(posted, listeners);

  return { posted, listeners, spawnChild: () => child };
}

function announceRotation(lane: CredentialLane): void {
  for (const listener of lane.listeners) {
    listener({
      kind: 'subscription-credential-update',
      id: 'u1',
      provider: 'openai',
      accountId: 'acc-codex',
      credential: 'rotated-blob',
    });
  }
}

function hostStoringWith(
  lane: CredentialLane,
  storeSubscriptionCredential: NonNullable<EngineHostDeps['storeSubscriptionCredential']>,
) {
  return createEngineHost({
    knownSlugs: [],
    spawnChild: lane.spawnChild,
    grantFor: grantsNothing,
    storeSubscriptionCredential,
  });
}

function hostWithNowhereToStore(lane: CredentialLane) {
  return createEngineHost({
    knownSlugs: [],
    spawnChild: lane.spawnChild,
    grantFor: grantsNothing,
  });
}

const keychainRefuses = async (): Promise<void> => {
  await Promise.reject(new Error('the keychain is locked'));
};

const answeredFailed = {
  kind: 'subscription-credential-updated',
  answers: 'u1',
  verdict: 'failed',
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('main durably stores a child credential update before acknowledging it', async () => {
  const lane = credentialLane();
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = vi.fn(async () => {
    await held;
  });
  const host = hostStoringWith(lane, store);

  await host.start(codex);
  announceRotation(lane);

  await vi.waitFor(() => {
    expect(store).toHaveBeenCalledOnce();
  });

  expect(lane.posted).not.toContainEqual(
    expect.objectContaining({ kind: 'subscription-credential-updated' }),
  );

  if (release !== undefined) {
    release();
  }

  await vi.waitFor(() => {
    expect(lane.posted).toContainEqual({
      kind: 'subscription-credential-updated',
      answers: 'u1',
      verdict: 'stored',
    });
  });
  expect(store).toHaveBeenCalledWith('openai', 'acc-codex', 'rotated-blob');
});

test('a credential update main could not store is answered as failed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const lane = credentialLane();
  const host = hostStoringWith(lane, keychainRefuses);

  await host.start(codex);
  announceRotation(lane);

  await vi.waitFor(() => {
    expect(lane.posted).toContainEqual(answeredFailed);
  });
});

test('a credential update main could not store is written down without the credential', async () => {
  const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const lane = credentialLane();
  const host = hostStoringWith(lane, keychainRefuses);

  await host.start(codex);
  announceRotation(lane);

  await vi.waitFor(() => {
    expect(complaint).toHaveBeenCalled();
  });

  const spoken = complaint.mock.calls.flat().map(String).join(' ');

  expect(spoken).toContain('the keychain is locked');
  expect(spoken).not.toContain('rotated-blob');
});

test('a host with nowhere to store a credential answers the update as failed', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const lane = credentialLane();
  const host = hostWithNowhereToStore(lane);

  await host.start(codex);
  announceRotation(lane);

  await vi.waitFor(() => {
    expect(lane.posted).toContainEqual(answeredFailed);
  });
});

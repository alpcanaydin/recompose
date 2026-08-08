import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import type { Crossing } from '../gateway-wire';

import { AIStudioRelay } from './ai-studio-relay';
import { reachCredentialed } from './credentialed-reach';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

function crossingFor(dialect: Crossing['dialect']): Crossing {
  return {
    dialect,
    raw: {},
    gatewayName: 'Build',
    virtualModel: 'fast',
    providerModel: 'gemini-2.5-pro',
  };
}

function aiStudioGrant(accountId?: string): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://aistudio.google.test',
    spend: {
      custody: 'credentialed',
      provider: 'aistudio',
      credential: 'aistudio-key',
      ...(accountId === undefined ? {} : { accountId }),
    },
  };
}

const neverFetches: typeof fetch = async () => {
  await Promise.resolve();

  throw new Error('no request may leave the machine');
};

describe('reaching AI Studio through the relay channel', () => {
  test('a grant naming no channel is refused rather than sent nowhere', async () => {
    const reaching = reachCredentialed(
      crossingFor('gemini'),
      aiStudioGrant(),
      { contents: [] },
      neverFetches,
      new AIStudioRelay(),
    );

    await expect(reaching).rejects.toThrow('wsrelay: AI Studio channel is unavailable');
  });

  test('a caller that wires no relay at all is refused', async () => {
    const reaching = reachCredentialed(
      crossingFor('gemini'),
      aiStudioGrant('channel-1'),
      { contents: [] },
      neverFetches,
    );

    await expect(reaching).rejects.toThrow('wsrelay: AI Studio channel is unavailable');
  });
});

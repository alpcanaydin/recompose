import type { SubscriptionProviderId } from '@recompose/contracts';

import { fc, test } from '@fast-check/vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect } from 'vitest';

import type { OutsideCredential, SubscriptionObservation } from './subscription-standing';

import { observeSubscription } from './subscription-standing';

let home: string;

async function recorded(file: string, contents: string | Uint8Array): Promise<void> {
  await writeFile(join(home, file), contents);
}

const credentialInTheKeychain = async () => Promise.resolve(true);
const nothingInTheKeychain = async () => Promise.resolve(false);

async function reading(
  provider: SubscriptionProviderId,
  outsideCredential: OutsideCredential = null,
  at?: string,
): Promise<SubscriptionObservation> {
  return observeSubscription({ provider, home: at ?? home, outsideCredential });
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'recompose-standing-'));
});

describe('reading how a Claude Code account stands', () => {
  test('given an untouched home, the account reads as lapsed and says nothing more', async () => {
    const observed = await reading('anthropic');

    expect(observed).toEqual({ standing: 'lapsed' });
  });

  test('given a credential the tool left in the home, the account reads as connected', async () => {
    await recorded('.credentials.json', JSON.stringify({ claudeAiOauth: { accessToken: 'x' } }));

    const observed = await reading('anthropic');

    expect(observed.standing).toBe('connected');
  });

  test('given the records name the person and the plan, the reading carries both', async () => {
    await recorded(
      '.credentials.json',
      JSON.stringify({ claudeAiOauth: { accessToken: 'x', subscriptionType: 'max' } }),
    );
    await recorded(
      '.claude.json',
      JSON.stringify({ oauthAccount: { emailAddress: 'ada@ex.com' } }),
    );

    const observed = await reading('anthropic');

    expect(observed).toEqual({ standing: 'connected', signedInAs: 'ada@ex.com', plan: 'max' });
  });

  test('given a machine that keeps the credential outside the home, the keychain settles it', async () => {
    await recorded(
      '.claude.json',
      JSON.stringify({ oauthAccount: { emailAddress: 'ada@ex.com' } }),
    );

    const observed = await reading('anthropic', credentialInTheKeychain);

    expect(observed).toEqual({ standing: 'connected', signedInAs: 'ada@ex.com' });
  });

  test('given an identity record but no credential anywhere, the account reads as lapsed', async () => {
    await recorded(
      '.claude.json',
      JSON.stringify({ oauthAccount: { emailAddress: 'ada@ex.com' } }),
    );

    const observed = await reading('anthropic', nothingInTheKeychain);

    expect(observed).toEqual({ standing: 'lapsed', signedInAs: 'ada@ex.com' });
  });

  test('given records that name blank fields, the reading stays silent rather than empty', async () => {
    await recorded(
      '.credentials.json',
      JSON.stringify({ claudeAiOauth: { subscriptionType: '   ' } }),
    );
    await recorded('.claude.json', JSON.stringify({ oauthAccount: { emailAddress: '' } }));

    const observed = await reading('anthropic');

    expect(observed).toEqual({ standing: 'connected' });
  });
});

describe('reading how a Codex account stands', () => {
  test('given an untouched home, the account reads as lapsed', async () => {
    const observed = await reading('openai');

    expect(observed).toEqual({ standing: 'lapsed' });
  });

  test('given the session the tool wrote, the account reads as connected', async () => {
    await recorded('auth.json', JSON.stringify({ tokens: { id_token: 'x' } }));

    const observed = await reading('openai');

    expect(observed.standing).toBe('connected');
  });

  test('given a record holding a key rather than a session, the account reads as connected', async () => {
    await recorded('auth.json', JSON.stringify({ OPENAI_API_KEY: 'sk-live' }));

    const observed = await reading('openai');

    expect(observed.standing).toBe('connected');
  });

  test('given a record that holds neither, the account reads as lapsed', async () => {
    await recorded('auth.json', JSON.stringify({ OPENAI_API_KEY: null, tokens: null }));

    const observed = await reading('openai');

    expect(observed.standing).toBe('lapsed');
  });
});

describe('the reading holds against whatever sits in the home', () => {
  test.prop([fc.uint8Array({ maxLength: 512 })])(
    'given arbitrary bytes where the identity record goes, no credential means lapsed',
    async (bytes) => {
      const scratch = await mkdtemp(join(tmpdir(), 'recompose-standing-'));

      await writeFile(join(scratch, '.claude.json'), bytes);

      const observed = await reading('anthropic', nothingInTheKeychain, scratch);

      expect(observed.standing).toBe('lapsed');
    },
  );

  test.prop([
    fc.uint8Array({ maxLength: 512 }),
    fc.constantFrom('anthropic' as const, 'openai' as const),
  ])(
    'given arbitrary bytes where a credential record goes, the reading answers rather than throws',
    async (bytes, provider) => {
      const scratch = await mkdtemp(join(tmpdir(), 'recompose-standing-'));
      const file = provider === 'anthropic' ? '.credentials.json' : 'auth.json';

      await writeFile(join(scratch, file), bytes);

      const observed = await reading(provider, null, scratch);

      expect(['connected', 'lapsed']).toContain(observed.standing);
    },
  );

  test('given a home that is not there at all, the reading answers lapsed', async () => {
    const observed = await reading('anthropic', null, join(home, 'never-created'));

    expect(observed).toEqual({ standing: 'lapsed' });
  });

  test('given a keychain that refuses to answer, the reading falls back to lapsed', async () => {
    const observed = await reading('anthropic', async () =>
      Promise.reject(new Error('user denied access')),
    );

    expect(observed).toEqual({ standing: 'lapsed' });
  });
});

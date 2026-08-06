import { describe, expect, test, vi } from 'vitest';

import { listProviderModels } from './model-list';

const neverFetches: typeof fetch = async () => {
  await Promise.resolve();

  throw new Error('no network look expected');
};

const claudeSubscription = {
  custody: 'subscription',
  provider: 'anthropic',
  accountId: 'acc-claude',
  credential: '{"claudeAiOauth":{"accessToken":"oauth"}}',
} as const;

function codexSubscription(plan: string) {
  const claims = Buffer.from(
    JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_plan_type: plan } }),
  ).toString('base64url');

  return {
    custody: 'subscription' as const,
    provider: 'openai' as const,
    accountId: 'acc-codex',
    credential: JSON.stringify({
      tokens: { access_token: 'oauth', id_token: `header.${claims}.signature` },
    }),
  };
}

describe('the model catalog shipped by the provider subscription clients', () => {
  test('Claude lists the pinned CLIProxyAPI registry without a network look', async () => {
    const fetchLike = vi.fn<typeof fetch>();
    const listing = await listProviderModels(
      fetchLike,
      'https://api.anthropic.com',
      claudeSubscription,
    );

    expect(listing.standing).toBe('listed');
    expect(listing.standing === 'listed' ? listing.modelIds : []).toContain('claude-sonnet-4-6');
    expect(listing.standing === 'listed' ? listing.modelIds : []).toContain('claude-opus-4-8');
    expect(fetchLike).not.toHaveBeenCalled();
  });

  test('a Codex Plus account lists the Plus-only Spark model', async () => {
    const listing = await listProviderModels(
      neverFetches,
      'https://chatgpt.com/backend-api/codex',
      codexSubscription('plus'),
    );

    expect(listing.standing).toBe('listed');
    expect(listing.standing === 'listed' ? listing.modelIds : []).toContain('gpt-5.3-codex-spark');
    expect(listing.standing === 'listed' ? listing.modelIds : []).toContain('gpt-5.6-sol');
  });

  test('a Codex Free account does not offer a model its plan cannot spend', async () => {
    const listing = await listProviderModels(
      neverFetches,
      'https://chatgpt.com/backend-api/codex',
      codexSubscription('free'),
    );

    expect(listing).toMatchObject({ standing: 'listed' });
    expect(listing.standing === 'listed' ? listing.modelIds : []).not.toContain(
      'gpt-5.3-codex-spark',
    );
  });
});

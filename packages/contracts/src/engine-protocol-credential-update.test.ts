import { describe, expect, test } from 'vitest';

import {
  engineSubscriptionCredentialUpdateSchema,
  engineSubscriptionCredentialUpdatedSchema,
} from './engine-protocol';

const update = {
  kind: 'subscription-credential-update',
  id: 'u1',
  provider: 'anthropic',
  accountId: 'acc-claude-max',
  credential: '{"claudeAiOauth":{"accessToken":"rotated"}}',
};

describe('the credential rotation lane beside a subscription spend', () => {
  test('the child can ask main to persist one complete rotated provider document', () => {
    expect(engineSubscriptionCredentialUpdateSchema.parse(update)).toEqual(update);
  });

  test('the update refuses a missing account, provider, credential, or correlation id', () => {
    for (const field of ['id', 'provider', 'accountId', 'credential'] as const) {
      const { [field]: omitted, ...incomplete } = update;

      expect(omitted).toBeDefined();
      expect(() => engineSubscriptionCredentialUpdateSchema.parse(incomplete)).toThrow();
    }
  });

  test('main acknowledges storage before the child retries with the rotated token', () => {
    const stored = {
      kind: 'subscription-credential-updated',
      answers: 'u1',
      verdict: 'stored',
    };

    expect(engineSubscriptionCredentialUpdatedSchema.parse(stored)).toEqual(stored);
    expect(
      engineSubscriptionCredentialUpdatedSchema.parse({ ...stored, verdict: 'failed' }),
    ).toEqual({ ...stored, verdict: 'failed' });
  });

  test('neither side accepts an unknown persistence verdict', () => {
    expect(() =>
      engineSubscriptionCredentialUpdatedSchema.parse({
        kind: 'subscription-credential-updated',
        answers: 'u1',
        verdict: 'ignored',
      }),
    ).toThrow();
  });
});

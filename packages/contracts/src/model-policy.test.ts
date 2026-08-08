import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { ACCOUNTS_VERSION, loadAccountsDocument } from './accounts';
import { normalizeExcludedModels, providerModelPoliciesSchema } from './model-policy';

describe('provider model policy storage', () => {
  test('provider keys and excluded models parse to one canonical spelling', () => {
    const parsed = loadAccountsDocument({
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [],
      modelPolicies: {
        ' Anthropic ': {
          excludedModels: [' Claude-Old ', 'claude-old', 'CLAUDE-OTHER'],
          aliases: [
            { name: ' Model-A ', alias: ' Alias-A ', displayName: ' Friendly ' },
            { name: 'model-a', alias: 'alias-a', displayName: 'Friendly' },
          ],
        },
      },
    });

    expect(parsed.modelPolicies).toEqual({
      anthropic: {
        excludedModels: ['claude-old', 'claude-other'],
        aliases: [{ name: 'model-a', alias: 'alias-a', displayName: 'Friendly' }],
      },
    });
  });

  test('a version four registry migrates without inventing policy', () => {
    expect(loadAccountsDocument({ schemaVersion: 4, accounts: [] })).toEqual({
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [],
    });
  });
});

describe('a provider policy that rules nothing out', () => {
  test('carries neither an exclusion list nor an alias list', () => {
    expect(providerModelPoliciesSchema.parse({ anthropic: {} })).toStrictEqual({ anthropic: {} });
  });
});

describe('policy entries no provider answers to', () => {
  test('a blank provider name leaves no policy behind', () => {
    const parsed = providerModelPoliciesSchema.parse({
      '   ': { excludedModels: ['ghost'] },
      anthropic: { excludedModels: ['claude-old'] },
    });

    expect(parsed).toStrictEqual({ anthropic: { excludedModels: ['claude-old'] } });
  });

  test('a blank model name leaves no exclusion behind', () => {
    const parsed = providerModelPoliciesSchema.parse({
      anthropic: { excludedModels: ['  ', '', ' Claude-Old '] },
    });

    expect(parsed).toStrictEqual({ anthropic: { excludedModels: ['claude-old'] } });
  });
});

describe('the order a policy reads back in', () => {
  test('providers read back alphabetically whatever order they were written in', () => {
    const parsed = providerModelPoliciesSchema.parse({
      openai: {},
      ' Mistral ': {},
      anthropic: {},
    });

    expect(Object.keys(parsed)).toStrictEqual(['anthropic', 'mistral', 'openai']);
  });

  test('aliases read back in one order whatever order they were written in', () => {
    const zeta = { name: 'Zeta', alias: 'Z-Alias' };
    const alpha = { name: 'Alpha', alias: 'A-Alias', displayName: 'Alpha Model' };

    expect(
      providerModelPoliciesSchema.parse({ anthropic: { aliases: [zeta, alpha] } }),
    ).toStrictEqual({
      anthropic: {
        aliases: [
          { name: 'alpha', alias: 'a-alias', displayName: 'Alpha Model' },
          { name: 'zeta', alias: 'z-alias' },
        ],
      },
    });
  });
});

describe('an alias written without a display name', () => {
  test('reads back without one', () => {
    const parsed = providerModelPoliciesSchema.parse({
      anthropic: { aliases: [{ name: ' Model-A ', alias: ' Alias-A ' }] },
    });

    expect(parsed).toStrictEqual({
      anthropic: { aliases: [{ name: 'model-a', alias: 'alias-a' }] },
    });
  });

  test('survives beside the same alias that carries one', () => {
    const parsed = providerModelPoliciesSchema.parse({
      anthropic: {
        aliases: [
          { name: 'model-a', alias: 'alias-a', displayName: 'Friendly' },
          { name: 'Model-A', alias: 'Alias-A' },
          { name: 'model-a', alias: 'alias-a' },
        ],
      },
    });

    expect(parsed).toStrictEqual({
      anthropic: {
        aliases: [
          { name: 'model-a', alias: 'alias-a' },
          { name: 'model-a', alias: 'alias-a', displayName: 'Friendly' },
        ],
      },
    });
  });
});

const modelNames = fc.oneof(fc.constantFrom('', '   ', ' Claude-Old ', 'claude-old'), fc.string());

describe('the canonical form of an exclusion list', () => {
  test.prop([fc.array(modelNames)])(
    'holds whatever order or spelling the models arrive in',
    (models) => {
      const excluded = normalizeExcludedModels(models);

      expect(normalizeExcludedModels([...models].reverse())).toStrictEqual(excluded);
      expect(normalizeExcludedModels(excluded)).toStrictEqual(excluded);
    },
  );
});

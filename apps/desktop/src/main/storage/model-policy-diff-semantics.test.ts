import type { AccountsDocument, ProviderModelPolicies } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { describe, expect, it } from 'vitest';

import {
  accountsDocumentSemanticHash,
  diffProviderExcludedModels,
  diffProviderModelAliases,
} from './model-policy-diff';

describe('watcher diff for a provider that stayed the same', () => {
  it('should report no excluded-model change when only the spelling differs', () => {
    const result = diffProviderExcludedModels(
      { providerA: ['model-1', 'model-2'] },
      { ProviderA: [' MODEL-2 ', 'model-1'] },
    );

    expect(result.changes).toEqual([]);
    expect(result.affectedProviders).toEqual([]);
  });

  it('should report no alias change when an alias without a display name is repeated', () => {
    const result = diffProviderModelAliases(
      { antigravity: [{ name: 'claude-opus', alias: 'fast-opus' }] },
      { Antigravity: [{ name: ' Claude-Opus ', alias: 'FAST-OPUS' }] },
    );

    expect(result.changes).toEqual([]);
    expect(result.affectedProviders).toEqual([]);
  });

  it('should report an alias change when the alias target moves', () => {
    const result = diffProviderModelAliases(
      { antigravity: [{ name: 'claude-opus', alias: 'fast-opus' }] },
      { antigravity: [{ name: 'claude-opus', alias: 'slow-opus' }] },
    );

    expect(result.changes).toEqual(['oauth-model-alias[antigravity]: updated (1 -> 1 entries)']);
    expect(result.affectedProviders).toEqual(['antigravity']);
  });
});

describe('accounts semantic hash over model policies', () => {
  it('should keep a policy that carries only aliases', () => {
    const withAliases = accountsDocumentSemanticHash(
      accounts({ anthropic: { aliases: [{ name: 'claude-opus', alias: 'fast-opus' }] } }),
    );

    expect(withAliases).not.toBe(accountsDocumentSemanticHash(accounts(undefined)));
  });

  it('should ignore a policy that carries nothing', () => {
    const empty = accountsDocumentSemanticHash(accounts({ anthropic: {} }));

    expect(empty).toBe(accountsDocumentSemanticHash(accounts(undefined)));
  });

  it('should ignore a policy whose excluded-model list is empty', () => {
    const emptyList = accountsDocumentSemanticHash(accounts({ anthropic: { excludedModels: [] } }));

    expect(emptyList).toBe(accountsDocumentSemanticHash(accounts(undefined)));
  });
});

// Helpers

function accounts(modelPolicies: ProviderModelPolicies | undefined): AccountsDocument {
  return {
    schemaVersion: ACCOUNTS_VERSION,
    accounts: [],
    ...(modelPolicies === undefined ? {} : { modelPolicies }),
  };
}

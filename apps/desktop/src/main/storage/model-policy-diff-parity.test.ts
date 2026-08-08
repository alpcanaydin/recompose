import type { ProviderModelAlias } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import {
  diffProviderExcludedModels,
  diffProviderModelAliases,
  summarizeExcludedModels,
  summarizeProviderExcludedModels,
} from './model-policy-diff';

describe('watcher diff excluded-model parity', () => {
  it('TestSummarizeExcludedModels_NormalizesAndDedupes', () => {
    expect(summarizeExcludedModels(['A', ' a ', 'B', 'b'])).toMatchObject({ count: 2 });
    expect(summarizeExcludedModels(['A', ' a ', 'B', 'b']).hash).not.toBe('');
    expect(summarizeExcludedModels([])).toEqual({ hash: '', count: 0 });
  });

  it('TestDiffOAuthExcludedModelChanges', () => {
    const result = diffProviderExcludedModels(
      { ProviderA: ['model-1', 'model-2'], providerB: ['x'] },
      { providerA: ['model-1', 'model-3'], providerC: ['y'] },
    );

    expect(result.changes).toEqual([
      'oauth-excluded-models[providera]: updated (2 -> 2 entries)',
      'oauth-excluded-models[providerb]: removed',
      'oauth-excluded-models[providerc]: added (1 entries)',
    ]);
    expect(result.affectedProviders).toEqual(['providera', 'providerb', 'providerc']);
  });

  it('TestSummarizeOAuthExcludedModels_NormalizesKeys', () => {
    const summary = summarizeProviderExcludedModels({ ProvA: ['X'], '': ['ignored'] });

    expect(Object.keys(summary)).toEqual(['prova']);
    expect(summary['prova']?.count).toBe(1);
    expect(summary['prova']?.hash).not.toBe('');
  });

  it('TestComputeExcludedModelsHash_Normalizes', () => {
    const first = summarizeExcludedModels([' A ', 'b', 'a']).hash;
    const second = summarizeExcludedModels(['a', ' b', 'A']).hash;

    expect(first).not.toBe('');
    expect(first).toBe(second);
    expect(first).not.toBe(summarizeExcludedModels(['c']).hash);
  });

  it('TestComputeExcludedModelsHash_Empty', () => {
    expect(summarizeExcludedModels([]).hash).toBe('');
    expect(summarizeExcludedModels(['  ', '']).hash).toBe('');
  });
});

describe('watcher diff provider model-alias parity', () => {
  it('TestDiffOAuthModelAliasChanges_IncludesDisplayName', () => {
    const alias = (displayName: string): ProviderModelAlias => ({
      name: 'claude-opus-4-6-thinking',
      alias: 'claude-antigravity-opus-4-6-thinking',
      displayName,
    });
    const result = diffProviderModelAliases(
      { antigravity: [alias('Antigravity Opus 4.6')] },
      { Antigravity: [alias('Antigravity Opus 4.6 (Thinking)')] },
    );

    expect(result.changes).toEqual(['oauth-model-alias[antigravity]: updated (1 -> 1 entries)']);
    expect(result.affectedProviders).toEqual(['antigravity']);
  });
});

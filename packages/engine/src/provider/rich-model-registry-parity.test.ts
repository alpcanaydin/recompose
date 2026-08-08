import { describe, expect, test } from 'vitest';

import { CLAUDE_SONNET_5, modelOverrideHeaders, xaiBuiltinVideoModels } from './model-metadata';
import { RichModelRegistry } from './rich-model-registry';

function model(id: string) {
  return {
    id,
    provider: 'openai',
    displayName: 'Model One',
    contextLength: 1_048_576,
    maxContextLength: 1_048_576,
    supportedParameters: ['temperature', 'top_p'],
    thinking: { levels: ['low', 'high'] },
  };
}

describe('static provider model metadata parity', () => {
  test('TestModelOverrideHeadersFromEmbeddedModels', () => {
    expect(modelOverrideHeaders('gpt-5.6-luna')).toHaveProperty(
      'user-agent',
      'codex-tui/0.144.0 (Mac OS 26.5.1; arm64) iTerm.app/3.6.11 (codex-tui; 0.144.0)',
    );
    expect(modelOverrideHeaders('gpt-5.4')).toBeUndefined();
  });

  test('TestWithXAIBuiltinsIncludesVideo15GAAndPreviewAlias', () => {
    expect(xaiBuiltinVideoModels).toContain('grok-imagine-video-1.5');
    expect(xaiBuiltinVideoModels).toContain('grok-imagine-video-1.5-preview');
  });

  test('TestLookupModelInfoIncludesClaudeSonnet5', () => {
    expect(CLAUDE_SONNET_5).toMatchObject({
      contextLength: 1_000_000,
      maxCompletionTokens: 128_000,
      thinking: {
        levels: ['low', 'medium', 'high', 'xhigh', 'max'],
        zeroAllowed: true,
        dynamicAllowed: true,
      },
    });
  });
});

describe('rich provider model registry parity', () => {
  test('TestGetAvailableModelsClaudeIncludesTokenLimits', () => {
    const registry = new RichModelRegistry();

    registry.register('claude', 'anthropic', [CLAUDE_SONNET_5]);

    expect(registry.availableByProvider('anthropic')[0]).toMatchObject({
      contextLength: 1_000_000,
      maxCompletionTokens: 128_000,
    });
  });

  test('TestGetAvailableModelInfosPreservesMetadataAndAvailability', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [model('z-model')]);
    registry.register('two', 'openai', [model('a-model')]);
    registry.suspend('one', 'z-model');

    const available = registry.available();
    const first = available[0];

    expect(available.map(({ id }) => id)).toEqual(['a-model']);
    if (first === undefined) throw new Error('expected available model');
    first.displayName = 'mutated';
    expect(registry.available()[0]?.displayName).toBe('Model One');
    expect(registry.available()[0]?.thinking?.levels).toEqual(['low', 'high']);
  });

  test('TestGetAvailableModelInfosHonorsQuotaAndSuspensionAvailability', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [model('m1')]);
    registry.setQuotaExceeded('one', 'm1', 2_000);
    expect(registry.available(1_000)).toEqual([]);
    registry.cleanupExpiredQuotas(3_000);
    expect(registry.available(3_000)).toHaveLength(1);
  });

  test('TestGetAvailableModelsReturnsClonedSupportedParameters', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [model('m1')]);
    const first = registry.available();
    const second = registry.available();

    expect(first[0]?.supportedParameters).toEqual(['temperature', 'top_p']);
    expect(first[0]?.supportedParameters).not.toBe(second[0]?.supportedParameters);
  });

  test('TestGetAvailableModelsIncludesMaxContextLengthOverride', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [model('deepseek-v4-flash')]);

    expect(registry.available()[0]).toMatchObject({
      contextLength: 1_048_576,
      maxContextLength: 1_048_576,
    });
  });
});

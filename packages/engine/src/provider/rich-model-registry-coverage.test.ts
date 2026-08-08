import { describe, expect, it } from 'vitest';

import type { ProviderModelMetadata } from './model-metadata';

import { RichModelRegistry } from './rich-model-registry';

function metadata(id: string, provider: string): ProviderModelMetadata {
  return {
    id,
    provider,
    supportedParameters: ['temperature'],
    thinking: { levels: ['low', 'high'] },
    headers: { 'x-provider': provider },
  };
}

function idsOf(models: readonly ProviderModelMetadata[]): string[] {
  return models.map(({ id }) => id);
}

describe('the rich model catalogue a client registers', () => {
  it('should list nothing for a client that never registered', () => {
    const registry = new RichModelRegistry();

    expect(registry.modelsForClient('ghost')).toEqual([]);
  });

  it('should hand every listing a detached copy of the registered metadata', () => {
    const registry = new RichModelRegistry();

    registry.register('one', ' OpenAI ', [metadata('gpt-5', 'openai')]);

    expect(registry.modelsForClient('one')).toEqual([metadata('gpt-5', 'openai')]);
    expect(registry.modelsForClient('one')[0]).not.toBe(registry.modelsForClient('one')[0]);
  });

  it('should count every registry change in the snapshot revision', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai')]);
    registry.suspend('one', 'gpt-5');
    registry.resume('one', 'gpt-5');
    registry.setQuotaExceeded('one', 'gpt-5', 10);
    registry.cleanupExpiredQuotas(20);

    expect(registry.snapshotRevision()).toBe(5);
  });

  it('should shrug off availability changes aimed at a client or model it never saw', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai')]);
    registry.suspend('ghost', 'gpt-5');
    registry.resume('ghost', 'gpt-5');
    registry.setQuotaExceeded('ghost', 'gpt-5', 10);
    registry.suspend('one', 'gpt-9');
    registry.setQuotaExceeded('one', 'gpt-9', 10);

    expect(idsOf(registry.availableByProvider('openai', 0))).toEqual(['gpt-5']);
  });
});

describe('rich model availability under suspension and quota', () => {
  it('should hide a suspended model and show it again once resumed', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai')]);
    registry.suspend('one', 'gpt-5');

    expect(registry.availableByProvider('openai', 0)).toEqual([]);

    registry.resume('one', 'gpt-5');

    expect(idsOf(registry.availableByProvider('openai', 0))).toEqual(['gpt-5']);
  });

  it('should hide a model under a quota hold until its deadline passes', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai')]);
    registry.setQuotaExceeded('one', 'gpt-5', 1_000);

    expect(registry.availableByProvider('openai', 500)).toEqual([]);
    expect(idsOf(registry.availableByProvider('openai', 1_000))).toEqual(['gpt-5']);
  });

  it('should clear an expired quota hold and leave a live one standing', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai'), metadata('gpt-6', 'openai')]);
    registry.setQuotaExceeded('one', 'gpt-5', 100);
    registry.setQuotaExceeded('one', 'gpt-6', 5_000);
    registry.cleanupExpiredQuotas(1_000);

    expect(idsOf(registry.availableByProvider('openai', 200))).toEqual(['gpt-5']);
  });
});

describe('rich model availability across providers', () => {
  it('should order the models of one provider by id', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [
      metadata('z-model', 'openai'),
      metadata('a-model', 'openai'),
    ]);

    expect(idsOf(registry.availableByProvider('openai', 0))).toEqual(['a-model', 'z-model']);
  });

  it('should leave the models of another provider out of the listing', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai')]);
    registry.register('two', 'anthropic', [metadata('claude-x', 'anthropic')]);

    expect(idsOf(registry.availableByProvider(' OPENAI ', 0))).toEqual(['gpt-5']);
  });

  it('should name a model shared by two clients of one provider only once', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('gpt-5', 'openai')]);
    registry.register('two', 'openai', [metadata('gpt-5', 'openai')]);

    expect(idsOf(registry.availableByProvider('openai', 0))).toEqual(['gpt-5']);
  });

  it('should gather every provider into one ordered listing', () => {
    const registry = new RichModelRegistry();

    registry.register('one', 'openai', [metadata('z-model', 'openai')]);
    registry.register('two', 'anthropic', [metadata('a-model', 'anthropic')]);

    expect(idsOf(registry.available(0))).toEqual(['a-model', 'z-model']);
    expect(idsOf(registry.available())).toEqual(['a-model', 'z-model']);
  });
});

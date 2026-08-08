import { expect, test } from 'vitest';

import { normalizeModelThinking, resolveConfiguredModelMetadata } from './model-config';

test('TestResolveModelInfoUsesSuffixFreeStaticCapabilities', () => {
  const info = resolveConfiguredModelMetadata('claude-opus-4-6(high)', 'anthropic');

  expect(info).toMatchObject({
    id: 'claude-opus-4-6(high)',
    provider: 'anthropic',
    userDefined: false,
  });
  expect(info.thinking).toBeDefined();
});

test('TestResolveModelInfoExplicitThinkingOverridesAndClones', () => {
  const thinking = { levels: [' XHIGH ', 'xhigh', ' High '] };
  const info = resolveConfiguredModelMetadata('custom-model', 'openai', thinking);

  expect(info.thinking?.levels).toEqual(['xhigh', 'high']);
  thinking.levels[0] = 'low';
  expect(info.thinking?.levels[0]).toBe('xhigh');
});

test('TestNormalizeThinkingSupportDerivesSpecialLevelFlags', () => {
  expect(normalizeModelThinking({ levels: ['low', 'none', 'auto'] })).toEqual({
    levels: ['low', 'none', 'auto'],
    zeroAllowed: true,
    dynamicAllowed: true,
  });
});

test('TestResolveModelInfoUnknownModelKeepsMissingCapability', () => {
  const info = resolveConfiguredModelMetadata('unknown-configured-model', 'anthropic');

  expect(info.thinking).toBeUndefined();
  expect(info.userDefined).toBe(false);
  expect(info.id).toBe('unknown-configured-model');
});

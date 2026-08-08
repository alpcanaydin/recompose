import type { Account, VirtualModel } from '@recompose/contracts';

import { expect, test } from 'vitest';

import { servedModels, servesTally } from './served-models';

const workKey: Account = {
  id: 'k1',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'work',
  credentialRef: 'c1',
};

const fast: VirtualModel = {
  id: 'fast',
  displayName: 'Fast',
  target: { accountId: 'k1', providerModel: 'claude-haiku-4-5' },
};

test('a definition whose target account still stands reads as serving it', () => {
  const [served] = servedModels([fast], [workKey]);

  expect(served).toEqual({
    id: 'fast',
    displayName: 'Fast',
    providerModel: 'claude-haiku-4-5',
    target: { standing: 'serving', account: workKey },
  });
});

test('a definition whose target account left the registry reads as removed', () => {
  const [served] = servedModels([fast], []);

  expect(served?.target).toEqual({ standing: 'removed' });
});

test('a definition still names the model it was bound to after its account left', () => {
  const [served] = servedModels([fast], []);

  expect(served?.providerModel).toBe('claude-haiku-4-5');
});

test('the definitions read in the order the gateway stores them', () => {
  const creative: VirtualModel = { ...fast, id: 'creative', displayName: 'Creative' };

  expect(servedModels([fast, creative], [workKey]).map((served) => served.id)).toEqual([
    'fast',
    'creative',
  ]);
});

test('a gateway holding no definition serves nothing at all', () => {
  expect(servedModels([], [workKey])).toEqual([]);
});

test('a gateway serving nothing says so rather than counting to zero', () => {
  expect(servesTally(0)).toBe('no virtual models yet');
});

test('one definition counts in the singular, because a tally a person reads is prose', () => {
  expect(servesTally(1)).toBe('1 virtual model');
});

test('several definitions count in the plural', () => {
  expect(servesTally(2)).toBe('2 virtual models');
});

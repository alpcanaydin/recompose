import type { GatewayConfig, VirtualModel } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { expect, test } from 'vitest';

import { IpcResultError } from '../../../shared/api';
import {
  discoveryHint,
  draftKept,
  gatewayDefining,
  idFollowingName,
  idRefusal,
  modelListReading,
  nameRefusal,
  refusalFromMain,
  servesPreview,
} from './model-draft';

const fast: VirtualModel = {
  id: 'fast',
  displayName: 'fast',
  target: { accountId: 'a1', providerModel: 'claude-sonnet-5' },
};

const codex: GatewayConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'codex',
  displayName: 'Codex',
  port: 8397,
  virtualModels: [],
  layout: { nodes: {} },
};

const noneHeld: readonly VirtualModel[] = [];

test('a name with nothing in it refuses, because no model can stand under it', () => {
  expect(nameRefusal('')).toBe('Give the virtual model a name.');
});

test('a name a person actually typed passes without a word', () => {
  expect(nameRefusal('Fast Sonnet')).toBeUndefined();
});

test('typing a name derives its id live, keeping the dots a client will send', () => {
  expect(idFollowingName('claude-5', 'claude-5.6', 'claude-5')).toBe('claude-5.6');
});

test('an id a person edited by hand detaches, so further name typing leaves it alone', () => {
  expect(idFollowingName('Fast', 'Faster', 'my-alias')).toBe('my-alias');
});

test('clearing a hand-edited id lets the name drive it again', () => {
  expect(idFollowingName('Fast', 'Faster', '')).toBe('faster');
});

test('an id no client could send refuses before anything is stored', () => {
  expect(idRefusal('Fast Model', noneHeld)).toBe(
    'recompose cannot serve a virtual model under this id.',
  );
});

test('an id this gateway already serves refuses rather than shadowing what stands', () => {
  expect(idRefusal('fast', [fast])).toBe(
    'This gateway already serves a virtual model named "fast".',
  );
});

test('an id carrying dots and no collision passes without a word', () => {
  expect(idRefusal('claude-5.6-sol', noneHeld)).toBeUndefined();
});

test("an id Claude Code's picker skips carries the hint that says so", () => {
  expect(discoveryHint('fast')).toContain('claude');
});

test("an id Claude Code's picker surfaces carries no hint", () => {
  expect(discoveryHint('claude-fast')).toBeUndefined();
  expect(discoveryHint('anthropic-fast')).toBeUndefined();
});

test('a settled draft reaches storage as the gateway carrying the id a person saw', () => {
  const defining = gatewayDefining(codex, {
    displayName: 'Claude 5.6 Sol',
    id: 'claude-5.6-sol',
    accountId: 'a1',
    providerModel: 'claude-sonnet-5',
  });

  expect(defining).toEqual({
    ...codex,
    virtualModels: [
      {
        id: 'claude-5.6-sol',
        displayName: 'Claude 5.6 Sol',
        target: { accountId: 'a1', providerModel: 'claude-sonnet-5' },
      },
    ],
  });
});

test('a definition joins the ones the gateway already holds rather than replacing them', () => {
  const defining = gatewayDefining(
    { ...codex, virtualModels: [fast] },
    { displayName: 'slow', id: 'slow', accountId: 'a1', providerModel: 'claude-opus-5' },
  );

  expect(defining.virtualModels.map((model) => model.id)).toEqual(['fast', 'slow']);
});

test('a gateway the rewrite could not find refuses in the words main wrote', () => {
  const refused = new IpcResultError({
    code: 'storage-failed',
    message: 'recompose stores no gateway under the slug "codex", so it has nothing to rewrite.',
  });

  expect(refusalFromMain(refused)).toBe(
    'recompose stores no gateway under the slug "codex", so it has nothing to rewrite.',
  );
});

test('a schema refusal trades its developer words for a sentence', () => {
  const refused = new IpcResultError({ code: 'validation-failed', message: 'invalid_type at [0]' });

  expect(refusalFromMain(refused)).toBe('recompose cannot store this virtual model as it stands.');
});

test('every other refusal reads in the words main wrote', () => {
  const namesake = new IpcResultError({
    code: 'name-conflict',
    message: 'Another gateway already holds the name "Codex".',
  });

  expect(refusalFromMain(namesake)).toBe('Another gateway already holds the name "Codex".');
  expect(refusalFromMain(new Error('the disk is full'))).toBe('the disk is full');
});

test('a look that answered a list offers those ids and refuses nothing', () => {
  const answer = { standing: 'listed', modelIds: ['claude-sonnet-5'] } as const;

  expect(modelListReading(answer)).toEqual({
    offered: ['claude-sonnet-5'],
    refusal: undefined,
  });
});

test('a look that reached nothing offers no id and carries the refusal it answered', () => {
  const answer = { standing: 'unlisted', refusal: 'nothing answered' } as const;

  expect(modelListReading(answer)).toEqual({ offered: [], refusal: 'nothing answered' });
});

test('a look still out offers no id and refuses nothing, because it has said nothing yet', () => {
  expect(modelListReading(undefined)).toEqual({ offered: [], refusal: undefined });
});

test('a draft handed back while the flow still stands is kept for the reopen', () => {
  const held = { displayName: 'Fast', id: 'fast', accountId: '', providerModel: '' };
  const handed = {
    displayName: 'Fast Sonnet',
    id: 'fast-sonnet',
    accountId: 'k1',
    providerModel: 'claude-sonnet-5',
  };

  expect(draftKept(held, handed)).toBe(handed);
});

test('a draft handed back after the flow was left keeps nothing, so nothing walks back in', () => {
  const handed = {
    displayName: 'Fast',
    id: 'fast',
    accountId: 'k1',
    providerModel: 'claude-sonnet-5',
  };

  expect(draftKept(undefined, handed)).toBeUndefined();
});

test('a settled draft previews the whole binding a client will reach', () => {
  const preview = servesPreview({
    id: 'fast',
    target: 'work',
    providerModel: 'claude-haiku-4-5',
  });

  expect(preview).toBe('serves as fast → work · claude-haiku-4-5');
});

test('a draft still missing its model previews nothing, because the binding is half said', () => {
  expect(servesPreview({ id: 'fast', target: 'work', providerModel: '' })).toBeUndefined();
});

test('a draft still missing its target previews nothing', () => {
  expect(
    servesPreview({ id: 'fast', target: undefined, providerModel: 'claude-haiku-4-5' }),
  ).toBeUndefined();
});

test('a draft whose id is not yet said previews nothing, because no id stands for it', () => {
  expect(
    servesPreview({ id: '', target: 'work', providerModel: 'claude-haiku-4-5' }),
  ).toBeUndefined();
});

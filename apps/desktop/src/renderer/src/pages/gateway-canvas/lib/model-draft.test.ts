import type { GatewayConfig, VirtualModel } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { expect, test } from 'vitest';

import { IpcResultError } from '../../../shared/api';
import {
  discoveryHint,
  draftKept,
  gatewayDefining,
  modelListReading,
  nameRefusal,
  previewWireId,
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

test('a name with nothing in it refuses, because no id can stand for it', () => {
  expect(nameRefusal('', noneHeld)).toBe('Give the virtual model a name.');
});

test('a name the gateway already defines refuses rather than shadowing what stands', () => {
  expect(nameRefusal('fast', [fast])).toBe(
    'This gateway already serves a virtual model named "fast".',
  );
});

test('a name landing on an id nothing can be served under refuses', () => {
  expect(nameRefusal('con', noneHeld)).toBe(
    'recompose cannot serve a virtual model under this name.',
  );
});

test('a free name a stored id can carry passes without a word', () => {
  expect(nameRefusal('Fast Sonnet', noneHeld)).toBeUndefined();
});

test('the sheet previews the id a name would be served under', () => {
  expect(previewWireId('Fast Sonnet')).toBe('fast-sonnet');
});

test('a name with nothing in it previews no id rather than a fallback nobody typed', () => {
  expect(previewWireId('  ')).toBeUndefined();
});

test("an id Claude Code's picker skips carries the hint that says so", () => {
  expect(discoveryHint('fast')).toContain('claude');
});

test("an id Claude Code's picker surfaces carries no hint", () => {
  expect(discoveryHint('claude-fast')).toBeUndefined();
  expect(discoveryHint('anthropic-fast')).toBeUndefined();
});

test('a settled draft reaches storage as the gateway carrying one more definition', () => {
  const defining = gatewayDefining(codex, {
    displayName: 'Fast Sonnet',
    accountId: 'a1',
    providerModel: 'claude-sonnet-5',
  });

  expect(defining).toEqual({
    ...codex,
    virtualModels: [
      {
        id: 'fast-sonnet',
        displayName: 'Fast Sonnet',
        target: { accountId: 'a1', providerModel: 'claude-sonnet-5' },
      },
    ],
  });
});

test('a definition joins the ones the gateway already holds rather than replacing them', () => {
  const defining = gatewayDefining(
    { ...codex, virtualModels: [fast] },
    { displayName: 'slow', accountId: 'a1', providerModel: 'claude-opus-5' },
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
  const held = { displayName: 'Fast', accountId: '', providerModel: '' };
  const handed = { displayName: 'Fast Sonnet', accountId: 'k1', providerModel: 'claude-sonnet-5' };

  expect(draftKept(held, handed)).toBe(handed);
});

test('a draft handed back after the flow was left keeps nothing, so nothing walks back in', () => {
  const handed = { displayName: 'Fast', accountId: 'k1', providerModel: 'claude-sonnet-5' };

  expect(draftKept(undefined, handed)).toBeUndefined();
});

test('a settled draft previews the whole binding a client will reach', () => {
  const preview = servesPreview({
    displayName: 'Fast',
    target: 'work',
    providerModel: 'claude-haiku-4-5',
  });

  expect(preview).toBe('serves as fast → work · claude-haiku-4-5');
});

test('a draft still missing its model previews nothing, because the binding is half said', () => {
  expect(servesPreview({ displayName: 'Fast', target: 'work', providerModel: '' })).toBeUndefined();
});

test('a draft still missing its target previews nothing', () => {
  expect(
    servesPreview({ displayName: 'Fast', target: undefined, providerModel: 'claude-haiku-4-5' }),
  ).toBeUndefined();
});

test('a draft nobody has named previews nothing, because no id stands for it yet', () => {
  expect(
    servesPreview({ displayName: '  ', target: 'work', providerModel: 'claude-haiku-4-5' }),
  ).toBeUndefined();
});

import { beforeEach, expect, test } from 'vitest';

import { lookedAtGateway, rememberedGateway } from './last-gateway';

beforeEach(() => {
  localStorage.clear();
});

test('a first launch remembers no gateway to return to', () => {
  expect(rememberedGateway(['codex'])).toBeUndefined();
});

test('the gateway a person was looking at is the one they come back to', () => {
  lookedAtGateway('codex');

  expect(rememberedGateway(['codex', 'claude'])).toBe('codex');
});

test('the latest gateway looked at replaces the one before it', () => {
  lookedAtGateway('codex');
  lookedAtGateway('claude');

  expect(rememberedGateway(['codex', 'claude'])).toBe('claude');
});

test('a remembered gateway that no longer exists reads as none at all', () => {
  lookedAtGateway('codex');

  expect(rememberedGateway(['claude'])).toBeUndefined();
});

test('a gateway gone from storage stays gone rather than returning with it', () => {
  lookedAtGateway('codex');

  expect(rememberedGateway([])).toBeUndefined();
  expect(rememberedGateway(['codex'])).toBe('codex');
});

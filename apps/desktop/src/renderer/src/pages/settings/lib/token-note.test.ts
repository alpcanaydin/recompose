import type { GatewayTokenStatus } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import { tokenRequirementDecision, tokenRequirementReason } from './token-note';

function holding(
  storage: GatewayTokenStatus['storage'],
  masked: string | null = null,
): GatewayTokenStatus {
  return { storage, masked };
}

describe('what turning the token requirement on decides', () => {
  test('a store the app cannot read refuses the change', () => {
    expect(tokenRequirementDecision(null, true)).toBe('refuse');
  });

  test('a store the app cannot use refuses the change', () => {
    expect(tokenRequirementDecision(holding('unavailable'), true)).toBe('refuse');
  });

  test('turning the requirement off saves without minting, whatever the store holds', () => {
    expect(tokenRequirementDecision(holding('unavailable'), false)).toBe('save');
  });

  test('the first token gets minted alongside the save', () => {
    expect(tokenRequirementDecision(holding('available'), true)).toBe('save-and-mint');
  });

  test('a token that already exists is kept rather than replaced', () => {
    expect(tokenRequirementDecision(holding('available', 'rc-local-••••1234'), true)).toBe('save');
  });
});

describe('what the requirement row says about the store behind it', () => {
  test('a store the app cannot read says so', () => {
    expect(tokenRequirementReason({ token: null, refused: false, mintRefused: false })).toMatch(
      /credential store could not be read/iu,
    );
  });

  test('a refused mint says so', () => {
    expect(
      tokenRequirementReason({ token: holding('available'), refused: false, mintRefused: true }),
    ).toMatch(/could not be minted/iu);
  });

  test('a refusal names what the app needs', () => {
    expect(
      tokenRequirementReason({ token: holding('unavailable'), refused: true, mintRefused: false }),
    ).toMatch(/system credential store/iu);
  });

  test('a machine with no keyring warns about plain text', () => {
    expect(
      tokenRequirementReason({
        token: holding('plaintext-fallback'),
        refused: false,
        mintRefused: false,
      }),
    ).toMatch(/plain text/iu);
  });

  test('a healthy store says nothing at all', () => {
    expect(
      tokenRequirementReason({ token: holding('available'), refused: false, mintRefused: false }),
    ).toBeUndefined();
  });
});

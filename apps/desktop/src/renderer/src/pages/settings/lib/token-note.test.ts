import { describe, expect, it } from 'vitest';

import { tokenRequirementNote } from './token-note';

describe('the token requirement row warns about the credential store behind it', () => {
  it('says nothing while the credential store encrypts', () => {
    expect(tokenRequirementNote('available', false)).toBeUndefined();
  });

  it('warns about plain text whenever the store falls back, even with the requirement off', () => {
    const note = tokenRequirementNote('plaintext-fallback', false);

    expect(note).toMatch(/keyring/i);
    expect(note).toMatch(/plain text/i);
  });

  it('states that a token needs a credential store once a turn-on is refused', () => {
    expect(tokenRequirementNote('unavailable', true)).toMatch(/credential store/i);
  });

  it('keeps quiet about an unusable store until someone asks for a token', () => {
    expect(tokenRequirementNote('unavailable', false)).toBeUndefined();
  });

  it('puts the refusal ahead of the plain-text warning', () => {
    expect(tokenRequirementNote('plaintext-fallback', true)).toMatch(/credential store/i);
  });
});

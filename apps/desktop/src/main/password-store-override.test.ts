import { describe, expect, it } from 'vitest';

import { resolvePasswordStoreOverride } from './password-store-override';

describe('password store override', () => {
  it('resolves to the backend the environment names', () => {
    const override = resolvePasswordStoreOverride({
      RECOMPOSE_PASSWORD_STORE: 'gnome-libsecret',
    });

    expect(override).toBe('gnome-libsecret');
  });

  it('leaves the platform default when the environment names nothing', () => {
    expect(resolvePasswordStoreOverride({})).toBeNull();
  });

  it('leaves the platform default when the override is empty', () => {
    expect(resolvePasswordStoreOverride({ RECOMPOSE_PASSWORD_STORE: '' })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { resolveUserDataOverride } from './user-data-override';

describe('user data override', () => {
  it('resolves to the directory the environment names', () => {
    const override = resolveUserDataOverride({ RECOMPOSE_USER_DATA_DIR: '/tmp/e2e-data' });

    expect(override).toBe('/tmp/e2e-data');
  });

  it('leaves the default location when the environment names nothing', () => {
    expect(resolveUserDataOverride({})).toBeNull();
  });

  it('leaves the default location when the override is empty', () => {
    expect(resolveUserDataOverride({ RECOMPOSE_USER_DATA_DIR: '' })).toBeNull();
  });
});

import { describe, expect, test } from 'vitest';

import { denyPermissionCheck, denyPermissionRequest } from './permission-policy';

describe('permission policy denies everything by default', () => {
  test('a permission request is denied', () => {
    expect(denyPermissionRequest()).toBe(false);
  });

  test('a permission check is denied', () => {
    expect(denyPermissionCheck()).toBe(false);
  });
});

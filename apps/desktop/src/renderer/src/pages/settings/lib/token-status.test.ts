import { describe, expect, test } from 'vitest';

import { tokenRowStatus } from './token-status';

const idle = { confirming: false, copied: false, copyFailed: false, mintFailed: false };

describe('what the credential row says about its last attempt', () => {
  test('a row nobody has touched says nothing', () => {
    expect(tokenRowStatus(idle)).toEqual({});
  });

  test('an open confirmation names the consequence, before anything happens', () => {
    expect(tokenRowStatus({ ...idle, confirming: true }).status).toMatch(/stop connecting/iu);
  });

  test('a mint the vault refused says so', () => {
    expect(tokenRowStatus({ ...idle, mintFailed: true }).status).toMatch(/could not be minted/iu);
  });

  test('a copy the vault refused says so, rather than reading as copied', () => {
    expect(tokenRowStatus({ ...idle, copied: true, copyFailed: true }).status).toMatch(
      /could not be copied/iu,
    );
  });

  test('a copy that landed says so', () => {
    expect(tokenRowStatus({ ...idle, copied: true }).status).toBe('Copied.');
  });

  test('the consequence outranks every other answer while the confirmation stands', () => {
    expect(
      tokenRowStatus({ confirming: true, copied: true, copyFailed: true, mintFailed: true }).status,
    ).toMatch(/stop connecting/iu);
  });
});

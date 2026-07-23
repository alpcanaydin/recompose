import { describe, expect, test } from 'vitest';

import { IpcResultError, unwrapIpcResult } from './ipc-result';

describe('ipc result unwrap', () => {
  test('a success envelope yields its value', () => {
    expect(unwrapIpcResult({ ok: true, value: 42 })).toBe(42);
  });

  test('a failure envelope throws a coded error', () => {
    let caught: unknown;

    try {
      unwrapIpcResult({ ok: false, error: { code: 'vault-unavailable', message: 'no keychain' } });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IpcResultError);

    const resultError = caught instanceof IpcResultError ? caught : null;

    expect(resultError?.code).toBe('vault-unavailable');
  });
});

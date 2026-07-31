import { describe, expect, test } from 'vitest';

import { IpcResultError, refusalSentence, unwrapIpcResult } from './ipc-result';

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
    expect(resultError?.message).toBe('no keychain');
  });
});

describe('the sentence a refusal reaches the screen as', () => {
  test('a refusal the main process wrote arrives in its own words', () => {
    expect(
      refusalSentence(new IpcResultError({ code: 'storage-failed', message: 'the disk is full' })),
    ).toBe('the disk is full');
  });

  test('a failure that explains nothing still says something', () => {
    expect(refusalSentence(new Error(''))).toBe('recompose gave no reason for refusing.');
  });

  test('a failure that is not an error at all says the same thing', () => {
    expect(refusalSentence('a thrown string')).toBe('recompose gave no reason for refusing.');
  });
});

import { describe, expect, test, vi } from 'vitest';

const encryptString = vi.fn((plain: string) => Buffer.from(`enc:${plain}`, 'utf8'));
const decryptString = vi.fn((buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, ''));
const isEncryptionAvailable = vi.fn(() => true);
const getSelectedStorageBackend = vi.fn(() => 'keychain');

vi.mock('electron', () => ({
  safeStorage: { encryptString, decryptString, isEncryptionAvailable, getSelectedStorageBackend },
}));

describe('safeStorage codec', () => {
  test('encrypt and decrypt delegate to the OS codec through base64', async () => {
    const { createSafeStorageCodec } = await import('./safe-storage-codec');
    const codec = createSafeStorageCodec();

    const encrypted = codec.encrypt('sk-abc');

    expect(encrypted).not.toContain('sk-abc');
    expect(codec.decrypt(encrypted)).toBe('sk-abc');
  });

  test('the plaintext-fallback backend is surfaced, not hidden', async () => {
    getSelectedStorageBackend.mockReturnValueOnce('basic_text');
    vi.resetModules();
    const { createSafeStorageCodec } = await import('./safe-storage-codec');

    expect(createSafeStorageCodec().isPlaintextFallback).toBe(true);
  });
});

import { safeStorage } from 'electron';

export type SecretCodec = {
  encrypt: (plain: string) => string;
  decrypt: (encryptedBase64: string) => string;
  isPlaintextFallback: boolean;
};

export function createSafeStorageCodec(): SecretCodec {
  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encryptedBase64) => safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64')),
    isPlaintextFallback: safeStorage.getSelectedStorageBackend() === 'basic_text',
  };
}

import { safeStorage } from 'electron';

export type SecretCodec = {
  encrypt: (plain: string) => string;
  decrypt: (encryptedBase64: string) => string;
  isPlaintextFallback: boolean;
};

export function createSafeStorageCodec(platform: NodeJS.Platform = process.platform): SecretCodec {
  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encryptedBase64) => safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64')),
    isPlaintextFallback:
      platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text',
  };
}

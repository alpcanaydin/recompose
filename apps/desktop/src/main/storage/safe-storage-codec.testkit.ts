import type { SecretCodec } from './safe-storage-codec';

/**
 * A codec that stands in for the operating system's keyring in a spec.
 *
 * @summary Base64 is reversible and readable, so a spec can prove a secret reached the vault
 * encrypted without needing a keyring on the machine running it. It reports no plaintext fallback,
 * because a spec that wants that state says so by building its own.
 */
export const reversibleCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

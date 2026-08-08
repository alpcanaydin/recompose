import { createHash } from 'node:crypto';

type Entry = { signature: string; expiresAt: number };

export class SignatureReplayCache {
  readonly #entries = new Map<string, Entry>();
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #minimumSignatureLength: number;

  public constructor(ttlMs: number, now: () => number = Date.now, minimumSignatureLength = 16) {
    this.#ttlMs = ttlMs;
    this.#now = now;
    this.#minimumSignatureLength = minimumSignatureLength;
  }

  public set(modelGroup: string, text: string, signature: string): boolean {
    const key = cacheKey(modelGroup, text);

    if (key === null || signature.length < this.#minimumSignatureLength) return false;

    this.#entries.set(key, { signature, expiresAt: this.#now() + this.#ttlMs });

    return true;
  }

  public get(modelGroup: string, text: string): string | undefined {
    const key = cacheKey(modelGroup, text);

    if (key === null) return undefined;

    const entry = this.#entries.get(key);

    if (entry === undefined) return undefined;

    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);

      return undefined;
    }

    return entry.signature;
  }

  public clearModel(modelGroup: string): void {
    const prefix = `${modelGroup.trim()}\0`;

    for (const key of this.#entries.keys()) {
      if (key.startsWith(prefix)) this.#entries.delete(key);
    }
  }

  public clearAll(): void {
    this.#entries.clear();
  }

  public hasValidSignature(modelGroup: string, text: string): boolean {
    return this.get(modelGroup, text) !== undefined;
  }
}

function cacheKey(modelGroup: string, text: string): string | null {
  const model = modelGroup.trim();

  if (model === '' || text === '') return null;

  return `${model}\0${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

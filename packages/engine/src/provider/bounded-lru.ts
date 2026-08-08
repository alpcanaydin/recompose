export class BoundedLRU<Key, Value> {
  readonly #capacity: number;
  readonly #entries = new Map<Key, Value>();
  readonly #pending = new Map<Key, Promise<Value>>();

  public constructor(capacity: number) {
    this.#capacity = Math.max(1, Math.floor(capacity));
  }

  public get(key: Key): Value | undefined {
    const value = this.#entries.get(key);

    if (value === undefined) return undefined;

    this.#entries.delete(key);
    this.#entries.set(key, value);

    return value;
  }

  public set(key: Key, value: Value): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    this.evict();
  }

  public async getOrCreate(key: Key, create: () => Promise<Value>): Promise<Value> {
    const existing = this.get(key);

    if (existing !== undefined) return existing;

    const pending = this.#pending.get(key);

    if (pending !== undefined) return pending;

    const created = this.createdValue(key, create);

    this.#pending.set(key, created);

    return created;
  }

  private async createdValue(key: Key, create: () => Promise<Value>): Promise<Value> {
    try {
      const value = await create();

      this.set(key, value);

      return value;
    } finally {
      this.#pending.delete(key);
    }
  }

  private evict(): void {
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value;

      if (oldest === undefined) return;

      this.#entries.delete(oldest);
    }
  }
}

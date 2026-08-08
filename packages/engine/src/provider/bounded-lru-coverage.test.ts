import { describe, expect, test } from 'vitest';

import { BoundedLRU } from './bounded-lru';

async function created(value: string): Promise<string> {
  await Promise.resolve();

  return value;
}

describe('holding a bounded number of entries', () => {
  test('a stored entry reads back', () => {
    const cache = new BoundedLRU<string, string>(2);

    cache.set('a', 'first');

    expect(cache.get('a')).toBe('first');
  });

  test('an absent key reads as nothing', () => {
    expect(new BoundedLRU<string, string>(2).get('missing')).toBeUndefined();
  });

  test('the least recently read entry leaves once the capacity is passed', () => {
    const cache = new BoundedLRU<string, string>(2);

    cache.set('a', 'first');
    cache.set('b', 'second');
    cache.get('a');
    cache.set('c', 'third');

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('first');
  });

  test('a capacity below one still holds a single entry', () => {
    const cache = new BoundedLRU<string, string>(0);

    cache.set('a', 'first');

    expect(cache.get('a')).toBe('first');
  });
});

describe('creating an entry only once', () => {
  test('an already stored entry is returned without creating another', async () => {
    const cache = new BoundedLRU<string, string>(2);

    await cache.getOrCreate('a', async () => created('first'));

    expect(await cache.getOrCreate('a', async () => created('second'))).toBe('first');
  });

  test('two callers racing for the same key share one creation', async () => {
    const cache = new BoundedLRU<string, string>(2);
    const both = await Promise.all([
      cache.getOrCreate('a', async () => created('first')),
      cache.getOrCreate('a', async () => created('second')),
    ]);

    expect(both).toEqual(['first', 'first']);
  });

  test('a failed creation leaves nothing behind', async () => {
    const cache = new BoundedLRU<string, string>(2);
    const failing = cache.getOrCreate('a', async () => {
      await Promise.resolve();

      throw new Error('provider unreachable');
    });

    await expect(failing).rejects.toThrow('provider unreachable');
    expect(cache.get('a')).toBeUndefined();
  });
});

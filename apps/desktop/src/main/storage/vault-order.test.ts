import { describe, expect, test } from 'vitest';

import { inVaultOrder } from './vault-order';

async function after(milliseconds: number): Promise<void> {
  return new Promise((settle) => {
    setTimeout(settle, milliseconds);
  });
}

describe('the queue that keeps vault writes from overlapping', () => {
  test('work takes its turn in the order it arrived', async () => {
    const finished: string[] = [];

    const slow = inVaultOrder(async () => {
      await after(20);
      finished.push('slow');
    });
    const quick = inVaultOrder(async () => {
      await after(0);
      finished.push('quick');
    });

    await Promise.all([slow, quick]);

    expect(finished).toEqual(['slow', 'quick']);
  });

  test('a write that fails hands the turn on rather than stranding the queue', async () => {
    const refused = inVaultOrder(async () => {
      await after(0);

      throw new Error('the vault refused the write');
    });

    await expect(refused).rejects.toThrow('the vault refused the write');

    const landed = await inVaultOrder(async () => {
      await after(0);

      return 'the next write lands';
    });

    expect(landed).toBe('the next write lands');
  });
});

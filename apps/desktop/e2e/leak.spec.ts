import { expect } from '@playwright/test';

import { test } from './fixtures';

test('navigation between screens keeps the heap bounded', { tag: '@leak' }, async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  const providers = page.getByRole('link', { name: 'API Keys' });
  const gateways = page.getByRole('link', { name: 'Gateways' });

  const roundTrip = async () => {
    await providers.click();
    await expect(page.getByRole('heading', { level: 1, name: 'API Keys' })).toBeVisible();
    await gateways.click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create your first gateway' }),
    ).toBeVisible();
  };

  const settledHeap = async () => {
    await client.send('HeapProfiler.collectGarbage');
    const usage = await client.send('Runtime.getHeapUsage');

    return usage.usedSize;
  };

  for (let warmup = 0; warmup < 5; warmup += 1) {
    await roundTrip();
  }

  const baseline = await settledHeap();

  for (let round = 0; round < 20; round += 1) {
    await roundTrip();
  }

  const after = await settledHeap();

  expect(after).toBeLessThan(baseline * 1.5);
});

import type { Page } from '@playwright/test';

/**
 * The field names the stored settings document currently holds.
 *
 * @summary Reach for it in any scenario asserting that a row owns no field on disk.
 */
export async function storedSettingsFields(page: Page): Promise<readonly string[]> {
  const stored = await page.evaluate(async () => window.recompose['settings:get']());

  if (!stored.ok) {
    throw new Error('The app could not read the stored settings document.');
  }

  return Object.keys(stored.value);
}

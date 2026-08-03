import { expect } from '@playwright/test';

import { Then, When } from '../fixtures';
import {
  catalog,
  catalogEntry,
  keyCatalogEntries,
  keyField,
  placementOf,
  screenTitle,
} from '../provider-screen';
import { keyEntryInFocus, rememberKeyEntry } from '../scenario-memory';

const ENTRIES_AND_THE_ONE_DISMISSAL = keyCatalogEntries.length + 1;

const ENTRIES_THAT_CONNECT = 2;

const WIDEST_TRAILING_INSET_PX = 24;

Then('the catalog opens over the screen, holding nine entries', async ({ page }) => {
  await expect(catalog(page)).toBeVisible();
  await expect(screenTitle(page)).toHaveText('API Keys');

  for (const entry of keyCatalogEntries) {
    await expect(catalogEntry(page, entry)).toBeVisible();
  }

  await expect(catalog(page).getByRole('button')).toHaveCount(ENTRIES_AND_THE_ONE_DISMISSAL);
});

Then(
  'only {string} and {string} answer a pick',
  async ({ page }, first: string, second: string) => {
    for (const entry of keyCatalogEntries) {
      const card = catalogEntry(page, entry);

      if (entry === first || entry === second) {
        await expect(card).not.toHaveAttribute('aria-disabled');
      } else {
        await expect(card).toHaveAttribute('aria-disabled', 'true');
      }
    }
  },
);

Then('the seven that cannot connect yet stand under Soon badges', async ({ page }) => {
  const badges = catalog(page).getByText('Soon', { exact: true });

  await expect(badges).toHaveCount(keyCatalogEntries.length - ENTRIES_THAT_CONNECT);
});

When(
  'the maintainer tries {string} by pointer and by keyboard',
  async ({ page }, entry: string) => {
    rememberKeyEntry(page, entry);

    const inert = catalogEntry(page, entry);

    await inert.dispatchEvent('click');
    await inert.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
  },
);

Then('nothing opens', async ({ page }) => {
  await expect(catalog(page).getByRole('button', { name: 'Back' })).toBeHidden();
  await expect(keyField(page)).toBeHidden();
  await expect(catalogEntry(page, 'Anthropic API')).toBeVisible();
});

Then('the entry reads as inert through more than color and position', async ({ page }) => {
  const inert = catalogEntry(page, keyEntryInFocus(page));

  await expect(inert).toHaveAttribute('aria-disabled', 'true');
  await expect(inert).toContainText('Soon');
});

Then(
  'the act that adds a provider stands at the trailing edge of the window strip',
  async ({ page }) => {
    const act = page.getByRole('main').getByRole('button', { name: 'Add provider' });

    await expect(act).toHaveCount(1);

    const stands = await placementOf(act);
    const title = await placementOf(screenTitle(page));
    const stripWidth = await page.evaluate(() => window.innerWidth);

    expect(stands.bottom).toBeLessThan(title.top);
    expect(stripWidth - stands.right).toBeLessThan(WIDEST_TRAILING_INSET_PX);
  },
);

import { expect } from '@playwright/test';

import { Given, Then } from '../fixtures';
import {
  accountRow,
  accountRows,
  keyAScenarioPastes,
  keyBody,
  keyEndingIn,
  keyStandsConnected,
  placementOf,
} from '../provider-screen';
import { keyEntryInFocus, rememberKeyEntry } from '../scenario-memory';

const NAME_A_SCENARIO_TYPES = 'build';

const MASKED_TAIL = /^••••\w{4}$/u;

const WITHIN_ONE_LINE_PX = 10;

Given(
  'a connected {string} key ending in {string}',
  async ({ page }, entry: string, tail: string) => {
    rememberKeyEntry(page, entry);
    await keyStandsConnected(page, {
      entry,
      name: NAME_A_SCENARIO_TYPES,
      pasted: keyEndingIn(entry, tail),
    });
  },
);

Then("the row's first line reads {string}", async ({ page }, product: string) => {
  await expect(accountRows(page).first().getByText(product, { exact: true })).toBeVisible();
});

Then(
  "the row's second line reads {string} beside the masked tail",
  async ({ page }, name: string) => {
    const row = accountRow(page, name);
    const named = row.getByText(name, { exact: true });
    const masked = row.getByText(MASKED_TAIL);

    await expect(masked).toBeVisible();

    const product = await placementOf(row.getByText(keyEntryInFocus(page), { exact: true }));
    const secondLine = await placementOf(named);
    const tail = await placementOf(masked);

    expect(secondLine.centerY).toBeGreaterThan(product.centerY);
    expect(Math.abs(tail.centerY - secondLine.centerY)).toBeLessThan(WITHIN_ONE_LINE_PX);
    expect(tail.left).toBeGreaterThan(secondLine.left);
  },
);

Then('the masked tail reads exactly {string}', async ({ page }, tail: string) => {
  const masked = accountRows(page).first().getByText(`••••${tail}`, { exact: true });

  await expect(masked).toBeVisible();
});

Then('no vendor prefix stands in front of it', async ({ page }) => {
  await expect(accountRows(page).first()).not.toContainText('sk-');
});

Then('no part of the screen prints the stored key', async ({ page }) => {
  const stored = keyAScenarioPastes(keyEntryInFocus(page));
  const printed = await page.getByRole('main').innerText();

  expect(printed).not.toContain(stored);
  expect(printed).not.toContain(keyBody);
});

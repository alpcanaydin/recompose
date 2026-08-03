import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import { accountRows, keyVerdict, openKeysScreen } from '../provider-screen';

/** The probe reaches a provider and answers over a spawned child, rather than on a keystroke. */
const CHECK_WAIT_MS = 20_000;

const GUESSED_REASONS = /typo|mistyped|revoked|revocation|expired|expiry/iu;

const BROKEN = /broken|failed|error/iu;

Given('the provider accepts the key', ({ keyProbe }) => {
  keyProbe.accepts();
});

Given('the provider no longer accepts the key', ({ keyProbe }) => {
  keyProbe.turnsAway();
});

Given("the provider can't be reached", ({ keyProbe }) => {
  keyProbe.cannotBeReached();
});

async function verifyThroughOverflow(page: Parameters<typeof accountRows>[0]) {
  await accountRows(page)
    .first()
    .getByRole('button', { name: /^Actions for/ })
    .click();
  await page.getByRole('menuitem', { name: 'Verify' }).click();
}

Given('the maintainer has verified the key', async ({ page }) => {
  await verifyThroughOverflow(page);
  await expect(keyVerdict(page)).toBeVisible({ timeout: CHECK_WAIT_MS });
});

When('the maintainer verifies the key', async ({ page }) => {
  await verifyThroughOverflow(page);
});

When('the maintainer leaves the screen and returns', async ({ page }) => {
  await page.getByRole('link', { name: 'Usage' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Usage' })).toBeVisible();
  await openKeysScreen(page);
});

Then('the surface reports that the key authenticates as of the check', async ({ page }) => {
  await expect(keyVerdict(page)).toHaveText('This key authenticated as of this check.', {
    timeout: CHECK_WAIT_MS,
  });
});

Then('nothing claims the account can spend', async ({ page }) => {
  await expect(page.getByRole('main')).not.toContainText('spend', { ignoreCase: true });
});

Then("the surface reports that the provider didn't accept the key", async ({ page }) => {
  await expect(keyVerdict(page)).toHaveText(
    "The provider didn't accept this key as of this check.",
    { timeout: CHECK_WAIT_MS },
  );
});

Then('the answer never guesses between a typo, a revocation, and an expiry', async ({ page }) => {
  await expect(keyVerdict(page)).not.toContainText(GUESSED_REASONS);
});

Then("the surface reports that the check couldn't run", async ({ page }) => {
  await expect(keyVerdict(page)).toHaveText(
    "This check couldn't reach the provider, so the key stands unverified.",
    { timeout: CHECK_WAIT_MS },
  );
});

Then('the row reads unverified rather than broken', async ({ page }) => {
  const row = accountRows(page).first();

  await expect(row).toContainText('unverified');
  await expect(row).not.toContainText(BROKEN);
});

Then('no row carries the earlier answer', async ({ page }) => {
  await expect(accountRows(page).first()).toBeVisible();
  await expect(accountRows(page).first().getByRole('status')).toHaveCount(0);
});

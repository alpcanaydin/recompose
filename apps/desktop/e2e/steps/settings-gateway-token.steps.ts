import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Given, Then, When } from '../fixtures';

const VAULT_REF = 'gateway-token';
const MASK_BULLETS = '••••••••';
const MASK_SHAPE = /^rc-local-•{8}.{4}$/;

const consequence = 'Clients holding the old token stop connecting.';
const needsStore = 'recompose cannot store a token without a system credential store.';
const plainText =
  'No system keyring is available, so recompose stores the token in plain text on this machine.';

type EarlierToken = {
  token: string;
  mask: string;
};

let earlier: EarlierToken | null = null;

function tokenRequirement(page: Page): Locator {
  return page.getByRole('switch', { name: 'Require API token' });
}

function maskOnScreen(page: Page): Locator {
  return page.getByText(MASK_SHAPE);
}

function maskOf(token: string): string {
  return `rc-local-${MASK_BULLETS}${token.slice(-4)}`;
}

function holdsEntries(value: unknown): value is { entries: Record<string, string> } {
  return typeof value === 'object' && value !== null && 'entries' in value;
}

async function userDataDir(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ app: running }) => running.getPath('userData'));
}

async function storedToken(app: ElectronApplication): Promise<string | null> {
  const vaultFile = join(await userDataDir(app), 'vault.bin');

  if (!existsSync(vaultFile)) {
    return null;
  }

  const vault: unknown = JSON.parse(await readFile(vaultFile, 'utf8'));

  if (!holdsEntries(vault)) {
    throw new Error(`the vault at ${vaultFile} carries no entries`);
  }

  const entry = vault.entries[VAULT_REF];

  if (entry === undefined) {
    return null;
  }

  return app.evaluate(
    ({ safeStorage }, secret) => safeStorage.decryptString(Buffer.from(secret, 'base64')),
    entry,
  );
}

async function requireStoredToken(app: ElectronApplication): Promise<string> {
  const token = await storedToken(app);

  if (token === null) {
    throw new Error('the vault holds no gateway token');
  }

  return token;
}

function recalled(): EarlierToken {
  if (earlier === null) {
    throw new Error('this scenario recorded no earlier token');
  }

  return earlier;
}

async function turnRequirementOn(app: ElectronApplication, page: Page): Promise<void> {
  await tokenRequirement(page).click();
  await expect(maskOnScreen(page)).toBeVisible();

  earlier = { token: await requireStoredToken(app), mask: await maskOnScreen(page).innerText() };
}

async function reopenSettings(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

async function expectMaskOfStoredToken(app: ElectronApplication, page: Page): Promise<void> {
  await expect(maskOnScreen(page)).toBeVisible();
  await expect(maskOnScreen(page)).toHaveText(maskOf(await requireStoredToken(app)));
}

Given('the token requirement is on', async ({ electronApp, page }) => {
  await turnRequirementOn(electronApp, page);
});

Given('the maintainer asked for a new token', async ({ electronApp, page }) => {
  await turnRequirementOn(electronApp, page);
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
});

Given(
  'the maintainer turned the token requirement on and then off',
  async ({ electronApp, page }) => {
    await turnRequirementOn(electronApp, page);
    await tokenRequirement(page).click();
    await expect(maskOnScreen(page)).toHaveCount(0);
  },
);

Given('the operating system credential store is unavailable', async ({ electronApp, page }) => {
  await electronApp.evaluate(({ safeStorage }) => {
    safeStorage.isEncryptionAvailable = () => false;
  });
  await reopenSettings(page);
});

Given(
  'the operating system credential store keeps secrets in plain text',
  async ({ electronApp, page }) => {
    await electronApp.evaluate(({ safeStorage }) => {
      Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });
      safeStorage.isEncryptionAvailable = () => true;
      safeStorage.getSelectedStorageBackend = () => 'basic_text';
    });
    await reopenSettings(page);
  },
);

Given('the operating system credential store encrypts secrets', async ({ electronApp, page }) => {
  await electronApp.evaluate(({ safeStorage }) => {
    safeStorage.isEncryptionAvailable = () => true;
    safeStorage.getSelectedStorageBackend = () => 'gnome_libsecret';
  });
  await reopenSettings(page);
});

When('the maintainer turns the token requirement on', async ({ page }) => {
  await tokenRequirement(page).click();
});

When('the maintainer turns the requirement off', async ({ page }) => {
  await tokenRequirement(page).click();
});

When('the maintainer turns the requirement on again', async ({ page }) => {
  await tokenRequirement(page).click();
});

When('the maintainer copies the token', async ({ page }) => {
  await page.getByRole('button', { name: 'Copy' }).click();
});

When('the maintainer asks for a new token', async ({ page }) => {
  await page.getByRole('button', { name: 'Regenerate' }).click();
});

When('the maintainer presses Escape', async ({ page }) => {
  await page.keyboard.press('Escape');
});

When('the maintainer confirms the regeneration', async ({ page }) => {
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(maskOnScreen(page)).not.toHaveText(recalled().mask);
});

Then('the token requirement reads off', async ({ page }) => {
  await expect(tokenRequirement(page)).not.toBeChecked();
});

Then('the requirement returns to off', async ({ page }) => {
  await expect(tokenRequirement(page)).not.toBeChecked();
});

Then('no token stands on the screen', async ({ page }) => {
  await expect(page.getByText('API token', { exact: true })).toHaveCount(0);
  await expect(maskOnScreen(page)).toHaveCount(0);
});

Then(
  'the token row shows a mask keeping the {string} prefix and the last four characters',
  async ({ electronApp, page }, prefix: string) => {
    await expect(maskOnScreen(page)).toBeVisible();

    const token = await requireStoredToken(electronApp);

    expect(token.startsWith(prefix)).toBe(true);
    await expect(maskOnScreen(page)).toHaveText(`${prefix}${MASK_BULLETS}${token.slice(-4)}`);
  },
);

Then('the whole token never appears on the screen', async ({ electronApp, page }) => {
  await expect(page.getByText(await requireStoredToken(electronApp))).toHaveCount(0);
});

Then('the clipboard holds the stored token', async ({ electronApp }) => {
  const token = await requireStoredToken(electronApp);

  await expect
    .poll(async () => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
    .toBe(token);
});

Then('the token row still shows only its mask', async ({ electronApp, page }) => {
  await expectMaskOfStoredToken(electronApp, page);
  await expect(page.getByText(await requireStoredToken(electronApp))).toHaveCount(0);
});

Then('the row states that clients holding the old token stop connecting', async ({ page }) => {
  await expect(page.getByText(consequence)).toBeVisible();
});

Then('the cancelling choice holds focus', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
});

Then('the stored token is unchanged', async ({ electronApp }) => {
  expect(await requireStoredToken(electronApp)).toBe(recalled().token);
});

Then('the stored token is the one minted the first time', async ({ electronApp }) => {
  expect(await requireStoredToken(electronApp)).toBe(recalled().token);
});

Then('the token row shows its mask again', async ({ electronApp, page }) => {
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expectMaskOfStoredToken(electronApp, page);
});

Then('the token row shows its mask', async ({ electronApp, page }) => {
  await expectMaskOfStoredToken(electronApp, page);
});

Then('the token row shows the mask of the new token', async ({ electronApp, page }) => {
  await expectMaskOfStoredToken(electronApp, page);
});

Then('the stored token differs from the one before', async ({ electronApp }) => {
  expect(await requireStoredToken(electronApp)).not.toBe(recalled().token);
});

Then('the token row shows the mask it showed before', async ({ page }) => {
  await expect(maskOnScreen(page)).toHaveText(recalled().mask);
});

Then('the stored settings document holds no token', async ({ electronApp }) => {
  const token = await requireStoredToken(electronApp);
  const settingsFile = join(await userDataDir(electronApp), 'settings.json');

  await expect.poll(() => existsSync(settingsFile)).toBe(true);

  const document = await readFile(settingsFile, 'utf8');

  expect(document).not.toContain(token);
  expect(document).not.toContain('rc-local-');
});

Then(
  'the row states that the token cannot be stored without a credential store',
  async ({ page }) => {
    await expect(page.getByText(needsStore)).toBeVisible();
  },
);

Then('no token is minted', async ({ electronApp }) => {
  expect(await storedToken(electronApp)).toBeNull();
});

Then(
  'the token requirement row states that no system keyring is available and recompose stores the token in plain text',
  async ({ page }) => {
    await expect(page.getByText(plainText)).toBeVisible();
  },
);

Then(
  'the token requirement row still states that recompose stores the token in plain text',
  async ({ page }) => {
    await expect(page.getByText(plainText)).toBeVisible();
  },
);

Then('no plain text warning stands on the screen', async ({ page }) => {
  await expect(page.getByText('plain text')).toHaveCount(0);
});

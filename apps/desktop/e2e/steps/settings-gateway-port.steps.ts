import type { Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { defaultSettings, loadSettings } from '@recompose/contracts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Then, When } from '../fixtures';

function portField(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Port' });
}

async function draftPort(page: Page, port: string): Promise<void> {
  await portField(page).fill(port);
}

async function commitPort(page: Page, port: string): Promise<void> {
  await draftPort(page, port);
  await portField(page).press('Enter');
}

function isMissingFile(failure: unknown): boolean {
  return failure instanceof Error && 'code' in failure && failure.code === 'ENOENT';
}

async function readStoredPort(settingsFile: string): Promise<number> {
  const document = await readFile(settingsFile, 'utf8').catch((failure: unknown) => {
    if (isMissingFile(failure)) {
      return null;
    }

    throw failure;
  });

  if (document === null) {
    return defaultSettings().enginePort;
  }

  const stored: unknown = JSON.parse(document);

  return loadSettings(stored).enginePort;
}

When(
  'the maintainer types {int} in the port field and moves focus away',
  async ({ page }, port: number) => {
    await draftPort(page, String(port));
    await portField(page).blur();
  },
);

When(
  'the maintainer types {int} in the port field and presses Enter',
  async ({ page }, port: number) => {
    await commitPort(page, String(port));
  },
);

When(
  'the maintainer types {int} in the port field and presses Escape',
  async ({ page }, port: number) => {
    await draftPort(page, String(port));
    await portField(page).press('Escape');
  },
);

When(
  'the maintainer types {int} in the port field and stops there',
  async ({ page }, port: number) => {
    await draftPort(page, String(port));
    await expect(portField(page)).toHaveValue(String(port));
  },
);

When('the maintainer commits {int} in the port field', async ({ page }, port: number) => {
  await commitPort(page, String(port));
});

When('the maintainer commits {string} in the port field', async ({ page }, port: string) => {
  await commitPort(page, port);
});

Then('the port field reads {int}', async ({ page }, port: number) => {
  await expect(portField(page)).toHaveValue(String(port));
});

Then('the stored port reads {int}', async ({ electronApp }, port: number) => {
  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'));

  const settingsFile = join(userDataPath, 'settings.json');

  await expect.poll(async () => readStoredPort(settingsFile)).toBe(port);
});

Then(
  'the field states that it accepts {int} through {int}',
  async ({ page }, min: number, max: number) => {
    await expect(page.getByText(`Accepts ${min} through ${max}.`)).toBeVisible();
  },
);

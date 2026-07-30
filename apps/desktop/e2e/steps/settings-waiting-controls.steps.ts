import type { ElectronApplication, Locator, Page } from '@playwright/test';

import { expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';

import { Then, When } from '../fixtures';

type WaitingRow = {
  label: string;
  role: 'radiogroup' | 'switch';
  awaits: string;
  settingField: string;
};

const waitingRows: readonly WaitingRow[] = [
  {
    label: 'Start gateways on launch',
    role: 'switch',
    awaits: 'Waits on launch-time start.',
    settingField: 'startGatewaysOnLaunch',
  },
  {
    label: 'Reduce wire motion',
    role: 'switch',
    awaits: 'Waiting on the canvas.',
    settingField: 'reduceWireMotion',
  },
  {
    label: 'Keep request logs',
    role: 'radiogroup',
    awaits: 'Waits on request logging.',
    settingField: 'keepRequestLogs',
  },
];

const tabPressesPerRow = 12;
const settingsDocumentName = 'settings.json';

let namedRow: WaitingRow | undefined;
let positionBeforeAttempt: string | undefined;
let rowsReachedByTab: readonly string[] = [];

function rowNamed(label: string): WaitingRow {
  const row = waitingRows.find((candidate) => candidate.label === label);

  if (row === undefined) {
    throw new Error(`The settings screen has no waiting row named "${label}".`);
  }

  return row;
}

function rowUnderDiscussion(): WaitingRow {
  if (namedRow === undefined) {
    throw new Error('No waiting row has been named yet in this scenario.');
  }

  return namedRow;
}

function containing(sentence: string): RegExp {
  return new RegExp(sentence.replaceAll(/[$()*+.?[\\\]^{|}]/gu, '\\$&'), 'u');
}

function controlOf(page: Page, row: WaitingRow): Locator {
  return page.getByRole(row.role, { name: row.label });
}

function keyboardTargetOf(page: Page, row: WaitingRow): Locator {
  const control = controlOf(page, row);

  return row.role === 'radiogroup' ? control.getByRole('radio', { checked: true }) : control;
}

async function positionOf(page: Page, row: WaitingRow): Promise<string> {
  const control = controlOf(page, row);

  if (row.role === 'radiogroup') {
    return control.getByRole('radio', { checked: true }).innerText();
  }

  return (await control.getAttribute('aria-checked')) ?? 'unreadable';
}

async function attemptToMove(page: Page, row: WaitingRow): Promise<void> {
  await keyboardTargetOf(page, row).focus();

  await page.keyboard.press(row.role === 'switch' ? 'Space' : 'ArrowRight');
}

async function holdsFocus(target: Locator): Promise<boolean> {
  return target.evaluate((element) => element === element.ownerDocument.activeElement);
}

async function keepsFocusWithin(control: Locator): Promise<boolean> {
  return control.evaluate((element) => {
    const active = element.ownerDocument.activeElement;

    return active !== null && element.contains(active);
  });
}

async function tabUntilFocused(page: Page, target: Locator): Promise<boolean> {
  for (let press = 0; press < tabPressesPerRow; press += 1) {
    await page.keyboard.press('Tab');

    if (await holdsFocus(target)) {
      return true;
    }
  }

  return false;
}

async function storedSettingsFields(page: Page): Promise<readonly string[]> {
  const stored = await page.evaluate(async () => window.recompose['settings:get']());

  if (!stored.ok) {
    throw new Error('The app could not read the stored settings document.');
  }

  return Object.keys(stored.value);
}

async function userDataEntries(electronApp: ElectronApplication): Promise<readonly string[]> {
  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'));

  return readdir(userDataPath);
}

Then('the {string} control cannot be moved', async ({ page }, label: string) => {
  const row = rowNamed(label);

  namedRow = row;

  await expect(controlOf(page, row)).toHaveAttribute('aria-disabled', 'true');

  await attemptToMove(page, row);

  await expect.poll(async () => keepsFocusWithin(controlOf(page, row))).toBe(true);
});

Then('the row names request logging as what it waits for', async ({ page }) => {
  await expect(controlOf(page, rowUnderDiscussion())).toHaveAccessibleDescription(
    containing('Waits on request logging.'),
  );
});

Then('the row names launch-time start as what it waits for', async ({ page }) => {
  await expect(controlOf(page, rowUnderDiscussion())).toHaveAccessibleDescription(
    containing('Waits on launch-time start.'),
  );
});

Then('the bind address row reads {string}', async ({ page }, address: string) => {
  await expect(page.getByText(address, { exact: true })).toBeVisible();
});

Then('the row states that recompose never serves the network', async ({ page }) => {
  await expect(
    page.getByText('Fixed at loopback. recompose never serves the network.'),
  ).toBeVisible();
});

Then('the row names the canvas as what it waits for', async ({ page }) => {
  await expect(controlOf(page, rowUnderDiscussion())).toHaveAccessibleDescription(
    containing('Waiting on the canvas.'),
  );
});

Then('the stored settings document holds no field for it', async ({ page }) => {
  expect(await storedSettingsFields(page)).not.toContain(rowUnderDiscussion().settingField);
});

When('the maintainer tabs through the settings screen', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings' }).focus();

  const reached: string[] = [];

  for (const row of waitingRows) {
    if (await tabUntilFocused(page, keyboardTargetOf(page, row))) {
      reached.push(row.label);
    }
  }

  rowsReachedByTab = reached;
});

Then('every waiting row takes focus in turn', () => {
  expect(rowsReachedByTab).toEqual(waitingRows.map((row) => row.label));
});

Then('each one states what it waits for while focused', async ({ page }) => {
  for (const row of waitingRows) {
    await expect(keyboardTargetOf(page, row)).toHaveAccessibleDescription(containing(row.awaits));
  }
});

When('the maintainer tries to start gateways on launch', async ({ page }) => {
  const row = rowNamed('Start gateways on launch');

  namedRow = row;
  positionBeforeAttempt = await positionOf(page, row);

  await attemptToMove(page, row);
});

Then('the control stays where it was', async ({ page }) => {
  expect(await positionOf(page, rowUnderDiscussion())).toBe(positionBeforeAttempt);
});

Then('the stored settings document is unchanged', async ({ electronApp, page }) => {
  expect(await storedSettingsFields(page)).not.toContain(rowUnderDiscussion().settingField);
  expect(await userDataEntries(electronApp)).not.toContain(settingsDocumentName);
});

import type { Settings } from '@recompose/contracts';

import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { unwrapIpcResult } from '../../../../shared/api';
import { renderAgainstBridge, reportingSystem } from '../../testing/render-settings';
import { SettingsPage } from '../settings-page/settings-page';

async function storedSettings(): Promise<Settings> {
  return unwrapIpcResult(await window.recompose['settings:get']());
}

test('the launch-at-login switch reports the operating system rather than the stored flag', async () => {
  const screen = await renderAgainstBridge(
    <SettingsPage />,
    reportingSystem({ loginItemEnabled: true }),
  );

  await expect
    .element(screen.getByRole('switch', { name: 'Launch at login' }))
    .toHaveAttribute('aria-checked', 'true');
});

test('a platform that will never support a login item carries no launch-at-login row', async () => {
  const screen = await renderAgainstBridge(
    <SettingsPage />,
    reportingSystem({ loginItem: 'unsupported' }),
  );

  await expect.element(screen.getByRole('group', { name: 'General' })).toBeVisible();
  expect(screen.getByRole('switch', { name: 'Launch at login' }).elements()).toHaveLength(0);
});

test('a development build offers the launch-at-login row but cannot move it', async () => {
  const screen = await renderAgainstBridge(
    <SettingsPage />,
    reportingSystem({ loginItem: 'unpackaged' }),
  );

  const control = screen.getByRole('switch', { name: 'Launch at login' });

  await expect.element(control).toHaveAttribute('aria-disabled', 'true');
  await expect.element(control).toHaveAccessibleDescription(/development build/i);
});

test('turning the menu bar switch on from the keyboard stores the new document', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />);

  screen.getByRole('switch', { name: 'Show in menu bar' }).element().focus();
  await userEvent.keyboard(' ');

  await expect.poll(async () => (await storedSettings()).showInMenuBar).toBe(true);
});

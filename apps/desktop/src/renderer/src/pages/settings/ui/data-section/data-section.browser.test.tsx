import { expect, test } from 'vitest';

import { renderAgainstBridge, reportingSystem } from '../../testing/render-settings';
import { SettingsPage } from '../settings-page/settings-page';

test('the config folder row names the folder without the account name in it', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />);

  await expect.element(screen.getByText('~/Library/Application Support/recompose')).toBeVisible();
});

test('the reveal action names Finder where the platform ships Finder', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />);

  await expect.element(screen.getByRole('button', { name: 'Reveal in Finder' })).toBeVisible();
});

test('the reveal action names Explorer where the platform ships Explorer', async () => {
  const screen = await renderAgainstBridge(
    <SettingsPage />,
    reportingSystem({ fileBrowser: 'explorer' }),
  );

  await expect.element(screen.getByRole('button', { name: 'Show in Explorer' })).toBeVisible();
});

test('the reveal action names neither where the platform ships its own file manager', async () => {
  const screen = await renderAgainstBridge(
    <SettingsPage />,
    reportingSystem({ fileBrowser: 'file-manager' }),
  );

  await expect.element(screen.getByRole('button', { name: 'Open folder' })).toBeVisible();
});

test('a folder that refuses to open says so on the row', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />, {
    overrides: {
      'system:open-config-folder': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'folder-open-failed', message: 'the folder did not open' },
        }),
    },
  });

  await screen.getByRole('button', { name: 'Reveal in Finder' }).click();

  await expect.element(screen.getByRole('alert')).toBeVisible();
});

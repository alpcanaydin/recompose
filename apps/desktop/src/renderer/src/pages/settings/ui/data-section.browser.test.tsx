import type { SystemState } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../shared/testing';

import { installFakeBridge } from '../../../shared/testing';
import { SettingsPage } from './settings-page';

const configFolder = '/Users/someone/Library/Application Support/recompose';

const observed: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder,
};

function reporting(state: Partial<SystemState>): BridgeParameters {
  return {
    overrides: {
      'system:get': async () => Promise.resolve({ ok: true, value: { ...observed, ...state } }),
    },
  };
}

async function renderSettings(parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    </QueryClientProvider>,
  );
}

test('the config folder row names the folder that holds the settings document', async () => {
  const screen = await renderSettings();

  await expect.element(screen.getByText(configFolder)).toBeVisible();
});

test('the reveal action names Finder where the platform ships Finder', async () => {
  const screen = await renderSettings();

  await expect.element(screen.getByRole('button', { name: 'Reveal in Finder' })).toBeVisible();
});

test('the reveal action names Explorer where the platform ships Explorer', async () => {
  const screen = await renderSettings(reporting({ fileBrowser: 'explorer' }));

  await expect.element(screen.getByRole('button', { name: 'Show in Explorer' })).toBeVisible();
});

test('the reveal action names neither where the platform ships its own file manager', async () => {
  const screen = await renderSettings(reporting({ fileBrowser: 'file-manager' }));

  await expect.element(screen.getByRole('button', { name: 'Open folder' })).toBeVisible();
});

test('a folder that refuses to open says so on the row', async () => {
  const screen = await renderSettings({
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

import type { Settings, SystemState } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../shared/testing';

import { unwrapIpcResult } from '../../../shared/api';
import { installFakeBridge } from '../../../shared/testing';
import { SettingsPage } from './settings-page';

const observed: SystemState = {
  fileBrowser: 'finder',
  loginItem: 'available',
  loginItemEnabled: false,
  menuBarVisible: false,
  configFolder: '/Users/someone/Library/Application Support/recompose',
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

async function storedSettings(): Promise<Settings> {
  return unwrapIpcResult(await window.recompose['settings:get']());
}

test('the launch-at-login switch reports the operating system rather than the stored flag', async () => {
  const screen = await renderSettings(reporting({ loginItemEnabled: true }));

  await expect
    .element(screen.getByRole('switch', { name: 'Launch at login' }))
    .toHaveAttribute('aria-checked', 'true');
});

test('a platform that will never support a login item carries no launch-at-login row', async () => {
  const screen = await renderSettings(reporting({ loginItem: 'unsupported' }));

  await expect.element(screen.getByRole('group', { name: 'General' })).toBeVisible();
  expect(screen.getByRole('switch', { name: 'Launch at login' }).elements()).toHaveLength(0);
});

test('a development build offers the launch-at-login row but cannot move it', async () => {
  const screen = await renderSettings(reporting({ loginItem: 'unpackaged' }));

  const control = screen.getByRole('switch', { name: 'Launch at login' });

  await expect.element(control).toHaveAttribute('aria-disabled', 'true');
  await expect.element(control).toHaveAccessibleDescription(/development build/i);
});

test('turning the menu bar switch on from the keyboard stores the new document', async () => {
  const screen = await renderSettings();

  screen.getByRole('switch', { name: 'Show in menu bar' }).element().focus();
  await userEvent.keyboard(' ');

  await expect.poll(async () => (await storedSettings()).showInMenuBar).toBe(true);
});

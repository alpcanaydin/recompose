import type { Settings, SystemState } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../shared/testing';

import { unwrapIpcResult } from '../../../shared/api';
import { installFakeBridge } from '../../../shared/testing';
import { SettingsPage } from './settings-page';

async function mount(page: ReactNode, parameters: BridgeParameters) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{page}</Suspense>
    </QueryClientProvider>,
  );
}

async function renderSettings(parameters: BridgeParameters = {}) {
  return mount(<SettingsPage />, parameters);
}

async function renderSettingsFromShortcut(parameters: BridgeParameters = {}) {
  return mount(<SettingsPage focus="first-control" />, parameters);
}

function runningOn(loginItem: SystemState['loginItem']): BridgeParameters {
  const observed: SystemState = {
    fileBrowser: 'finder',
    loginItem,
    loginItemEnabled: false,
    menuBarVisible: false,
    configFolder: '/Users/someone/Library/Application Support/recompose',
  };

  return {
    overrides: { 'system:get': async () => Promise.resolve({ ok: true, value: observed }) },
  };
}

async function storedSettings(): Promise<Settings> {
  return unwrapIpcResult(await window.recompose['settings:get']());
}

test('the screen groups its settings under General, Server, Appearance, and Data in that order', async () => {
  const screen = await renderSettings();

  await expect.element(screen.getByRole('group', { name: 'General' })).toBeVisible();

  const headings = screen.getByRole('heading', { level: 2 }).elements();

  expect(headings.map((heading) => heading.textContent)).toEqual([
    'General',
    'Server',
    'Appearance',
    'Data',
  ]);
});

test('a row that waits on the engine stays reachable and names the engine', async () => {
  const screen = await renderSettings();

  const waiting = [
    screen.getByRole('textbox', { name: 'Bind address' }),
    screen.getByRole('switch', { name: 'Start gateways on launch' }),
    screen.getByRole('radiogroup', { name: 'Keep request logs' }),
  ];

  for (const control of waiting) {
    await expect.element(control).toHaveAttribute('aria-disabled', 'true');
    await expect.element(control).not.toHaveAttribute('disabled');
    await expect.element(control).toHaveAccessibleDescription(/engine/i);
  }
});

test('the reduced wire motion row stays reachable and names the canvas', async () => {
  const screen = await renderSettings();

  const row = screen.getByRole('switch', { name: 'Reduce wire motion' });

  await expect.element(row).toHaveAttribute('aria-disabled', 'true');
  await expect.element(row).toHaveAccessibleDescription(/canvas/i);
});

test('no waiting row owns a field in the settings document', async () => {
  await renderSettings();

  expect(Object.keys(await storedSettings()).sort()).toEqual([
    'enginePort',
    'launchAtLogin',
    'requireGatewayToken',
    'schemaVersion',
    'showInMenuBar',
    'theme',
  ]);
});

test('the telemetry row states a value rather than offering a control', async () => {
  const screen = await renderSettings();

  await expect.element(screen.getByText('None', { exact: true })).toBeVisible();
  await expect.element(screen.getByText(/never phones home/i)).toBeVisible();
});

test('switching the theme to dark stores the new document', async () => {
  const screen = await renderSettings();

  await screen.getByRole('radio', { name: 'Dark' }).click();

  await expect.poll(async () => (await storedSettings()).theme).toBe('dark');
});

test('a rejected write returns the theme to the stored value and states what went wrong', async () => {
  const screen = await renderSettings({
    overrides: {
      'settings:save': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'the settings file could not be written' },
        }),
    },
  });

  await screen.getByRole('radio', { name: 'Dark' }).click();

  await expect.element(screen.getByRole('alert')).toBeVisible();
  await expect
    .element(screen.getByRole('radio', { name: 'System' }))
    .toHaveAttribute('aria-checked', 'true');
  expect((await storedSettings()).theme).toBe('system');
});

test('two changes in quick succession both survive', async () => {
  const screen = await renderSettings();

  await screen.getByRole('radio', { name: 'Dark' }).click();
  await screen.getByRole('textbox', { name: 'Port' }).fill('9000');
  await screen.getByRole('heading', { name: 'Settings' }).click();

  await expect
    .poll(async () => {
      const stored = await storedSettings();

      return `${stored.theme}:${String(stored.enginePort)}`;
    })
    .toBe('dark:9000');
});

test('a change leaves the maintainer on the control they used', async () => {
  const screen = await renderSettings();

  await screen.getByRole('radio', { name: 'Dark' }).click();

  await expect.poll(async () => (await storedSettings()).theme).toBe('dark');
  expect(document.activeElement?.textContent).toBe('Dark');
});

test('the shortcut lands on the launch switch where the operating system keeps login items', async () => {
  const screen = await renderSettingsFromShortcut(runningOn('available'));

  await expect.element(screen.getByRole('switch', { name: 'Launch at login' })).toHaveFocus();
});

test('the shortcut skips the launch switch a development build cannot move', async () => {
  const screen = await renderSettingsFromShortcut(runningOn('unpackaged'));

  await expect.element(screen.getByRole('switch', { name: 'Launch at login' })).not.toHaveFocus();
  await expect.element(screen.getByRole('switch', { name: 'Show in menu bar' })).toHaveFocus();
});

test('the shortcut lands on the menu bar switch where no login item exists', async () => {
  const screen = await renderSettingsFromShortcut(runningOn('unsupported'));

  await expect.element(screen.getByRole('switch', { name: 'Show in menu bar' })).toHaveFocus();
});

test('a settings arrival without the shortcut disturbs nobody', async () => {
  const screen = await renderSettings(runningOn('available'));

  await expect.element(screen.getByRole('group', { name: 'General' })).toBeVisible();
  await expect.element(screen.getByRole('switch', { name: 'Launch at login' })).not.toHaveFocus();
});

test('the screen offers no save, apply, or cancel action', async () => {
  const screen = await renderSettings();

  await expect.element(screen.getByRole('group', { name: 'General' })).toBeVisible();

  for (const name of ['Save', 'Apply', 'Cancel']) {
    expect(screen.getByRole('button', { name }).elements()).toHaveLength(0);
  }
});

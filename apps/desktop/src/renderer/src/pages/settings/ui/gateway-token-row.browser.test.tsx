import type { Settings } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../shared/testing';

import { unwrapIpcResult } from '../../../shared/api';
import { installFakeBridge } from '../../../shared/testing';
import { SettingsPage } from './settings-page';

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

async function turnOnRequirement(screen: Awaited<ReturnType<typeof renderSettings>>) {
  screen.getByRole('switch', { name: 'Require API token' }).element().focus();

  await userEvent.keyboard(' ');
}

async function renderWithToken() {
  const screen = await renderSettings();

  await turnOnRequirement(screen);
  await expect.element(screen.getByText(/^rc-local-/)).toBeVisible();

  return screen;
}

test('the requirement ships off and no token stands on the screen', async () => {
  const screen = await renderSettings();

  await expect
    .element(screen.getByRole('switch', { name: 'Require API token' }))
    .toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText(/rc-local-/).elements()).toHaveLength(0);
});

test('turning the requirement on mints a token and shows only its mask', async () => {
  const screen = await renderSettings();

  await turnOnRequirement(screen);

  await expect.element(screen.getByText(/^rc-local-/)).toBeVisible();
  await expect.element(screen.getByText(/•/)).toBeVisible();
  expect(Object.keys(await storedSettings())).not.toContain('gatewayToken');
});

test('copying the token announces itself and leaves the mask on the row', async () => {
  const screen = await renderWithToken();

  await screen.getByRole('button', { name: 'Copy' }).click();

  await expect.element(screen.getByText('Copied.')).toBeVisible();
  await expect.element(screen.getByText(/^rc-local-/)).toBeVisible();
});

test('regeneration states its consequence and holds focus on the cancelling choice', async () => {
  const screen = await renderWithToken();

  await screen.getByRole('button', { name: 'Regenerate' }).click();

  await expect.element(screen.getByText(/stop connecting/i)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
});

test('Escape abandons a regeneration and brings the mask back', async () => {
  const screen = await renderWithToken();

  const before = screen.getByText(/^rc-local-/).element().textContent;

  await screen.getByRole('button', { name: 'Regenerate' }).click();
  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
  expect(screen.getByText(/^rc-local-/).element().textContent).toBe(before);
});

test('confirming a regeneration replaces the token', async () => {
  const screen = await renderWithToken();

  const before = screen.getByText(/^rc-local-/).element().textContent;

  await screen.getByRole('button', { name: 'Regenerate' }).click();
  await screen.getByRole('button', { name: 'Regenerate' }).click();

  await expect.poll(() => screen.getByText(/^rc-local-/).element().textContent).not.toBe(before);
});

test('the stored settings document carries no fragment of the token', async () => {
  const screen = await renderWithToken();

  await screen.getByRole('button', { name: 'Regenerate' }).click();
  await screen.getByRole('button', { name: 'Regenerate' }).click();
  await expect.element(screen.getByText(/^rc-local-/)).toBeVisible();

  expect(JSON.stringify(await storedSettings())).not.toMatch(/rc-local-/);
});

test('turning the requirement off takes the token row off the screen', async () => {
  const screen = await renderWithToken();

  await expect.element(screen.getByRole('button', { name: 'Copy' })).toBeVisible();

  screen.getByRole('switch', { name: 'Require API token' }).element().focus();
  await userEvent.keyboard(' ');

  await expect.poll(() => screen.getByRole('button', { name: 'Copy' }).elements()).toHaveLength(0);
});

test('a mint the vault refuses states why, rather than reading as nothing minted yet', async () => {
  const screen = await renderSettings({
    overrides: {
      'gateway-token:mint': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'the vault refused the write' },
        }),
    },
  });

  await turnOnRequirement(screen);

  await expect.element(screen.getByText('The value could not be minted.')).toBeVisible();
});

test('a copy the vault refuses states why, rather than reading as copied', async () => {
  const screen = await renderWithToken();

  installFakeBridge({
    overrides: {
      'gateway-token:copy': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'token-missing', message: 'no token stands in the vault' },
        }),
    },
  });

  await screen.getByRole('button', { name: 'Copy' }).click();

  await expect.element(screen.getByText('The value could not be copied.')).toBeVisible();
});

test('a credential store that cannot be read leaves the rest of the screen reachable', async () => {
  const screen = await renderSettings({
    overrides: {
      'gateway-token:status': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'the vault could not be decrypted' },
        }),
    },
  });

  await expect.element(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeVisible();
  await expect.element(screen.getByText(/credential store could not be read/u)).toBeVisible();
  await expect
    .element(screen.getByRole('switch', { name: 'Require API token' }))
    .toHaveAttribute('aria-disabled', 'true');
});

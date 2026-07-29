import type { GatewayTokenStatus, Settings } from '@recompose/contracts';

import { defaultSettings } from '@recompose/contracts';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../shared/testing';

import { unwrapIpcResult } from '../../../shared/api';
import { renderAgainstBridge } from '../testing/render-settings';
import { SettingsPage } from './settings-page';

function storing(storage: GatewayTokenStatus['storage'], masked: string | null): BridgeParameters {
  return {
    overrides: {
      'gateway-token:status': async () => Promise.resolve({ ok: true, value: { masked, storage } }),
      'gateway-token:mint': async () =>
        Promise.resolve({ ok: true, value: { masked: 'rc-local-••••••••mint', storage } }),
    },
  };
}

async function storedSettings(): Promise<Settings> {
  return unwrapIpcResult(await window.recompose['settings:get']());
}

test('a credential store that keeps secrets in plain text warns before the first token', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />, storing('plaintext-fallback', null));

  await expect
    .element(screen.getByRole('switch', { name: 'Require API token' }))
    .toHaveAttribute('aria-checked', 'false');
  await expect.element(screen.getByText(/plain text/i)).toBeVisible();
  await expect.element(screen.getByText(/keyring/i)).toBeVisible();
});

test('the plain text warning stays once a token exists', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />, {
    ...storing('plaintext-fallback', 'rc-local-••••••••abcd'),
    settings: { ...defaultSettings(), requireGatewayToken: true },
  });

  await expect.element(screen.getByText(/^rc-local-/)).toBeVisible();
  await expect.element(screen.getByText(/plain text/i)).toBeVisible();
});

test('an encrypting credential store shows no plain text warning', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />, storing('available', null));

  expect(screen.getByText(/plain text/i).elements()).toHaveLength(0);
});

test('a credential store the app cannot use returns the requirement to off', async () => {
  const screen = await renderAgainstBridge(<SettingsPage />, storing('unavailable', null));

  screen.getByRole('switch', { name: 'Require API token' }).element().focus();
  await userEvent.keyboard(' ');

  await expect.element(screen.getByText(/credential store/i)).toBeVisible();
  await expect
    .element(screen.getByRole('switch', { name: 'Require API token' }))
    .toHaveAttribute('aria-checked', 'false');
  expect((await storedSettings()).requireGatewayToken).toBe(false);
});

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

async function storedPort(): Promise<Settings['enginePort']> {
  return unwrapIpcResult(await window.recompose['settings:get']()).enginePort;
}

test('leaving the port field commits what was typed', async () => {
  const screen = await renderSettings();

  await screen.getByRole('textbox', { name: 'Port' }).fill('9000');
  await screen.getByRole('heading', { name: 'Settings' }).click();

  await expect.poll(storedPort).toBe(9000);
});

test('Enter commits what was typed in the port field', async () => {
  const screen = await renderSettings();

  const port = screen.getByRole('textbox', { name: 'Port' });

  await port.fill('9000');
  await port.click();
  await userEvent.keyboard('{Enter}');

  await expect.poll(storedPort).toBe(9000);
});

test('Escape abandons an entry and leaves the stored port alone', async () => {
  const screen = await renderSettings();

  const port = screen.getByRole('textbox', { name: 'Port' });

  await port.fill('9000');
  await port.click();
  await userEvent.keyboard('{Escape}');

  await expect.element(port).toHaveValue('8397');
  expect(await storedPort()).toBe(8397);
});

test('an entry left uncommitted writes nothing', async () => {
  const screen = await renderSettings();

  await screen.getByRole('textbox', { name: 'Port' }).fill('9000');

  expect(await storedPort()).toBe(8397);
});

test('a port below the accepted range keeps the stored port and states the range', async () => {
  const screen = await renderSettings();

  const port = screen.getByRole('textbox', { name: 'Port' });

  await port.fill('1023');
  await screen.getByRole('heading', { name: 'Settings' }).click();

  await expect.element(port).toHaveValue('8397');
  await expect.element(screen.getByText(/1024/)).toBeVisible();
  expect(await storedPort()).toBe(8397);
});

test('a non-numeric entry keeps the stored port', async () => {
  const screen = await renderSettings();

  const port = screen.getByRole('textbox', { name: 'Port' });

  await port.fill('eight thousand');
  await screen.getByRole('heading', { name: 'Settings' }).click();

  await expect.element(port).toHaveValue('8397');
  expect(await storedPort()).toBe(8397);
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { CreateGatewaySheet } from './create-gateway-sheet';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

function SheetHarness() {
  const [open, setOpen] = useState(true);

  return <CreateGatewaySheet onCreated={() => {}} onOpenChange={setOpen} open={open} />;
}

async function openSheet(parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <SheetHarness />
    </QueryClientProvider>,
  );

  await expect.element(page.getByRole('dialog', { name: 'Create a gateway' })).toBeVisible();
}

const sheet = () => page.getByRole('dialog', { name: 'Create a gateway' });

const nameField = () => page.getByRole('textbox', { name: 'Name' });

async function press(name: string) {
  page.getByRole('button', { name }).element().focus();

  await userEvent.keyboard('{Enter}');
}

async function storedGateways() {
  const answer = await window.recompose['gateways:list']();

  if (!answer.ok) {
    throw new Error(answer.error.message);
  }

  return answer.value;
}

function refusedSave(code: 'storage-failed' | 'validation-failed', message: string) {
  return {
    overrides: {
      'gateways:save': async () =>
        Promise.resolve({ ok: false as const, error: { code, message } }),
    },
  };
}

test('a name Windows keeps for a device keeps the sheet open and says so', async () => {
  await openSheet();

  await nameField().fill('Con');
  await press('Create Gateway');

  await expect.element(page.getByText('Windows reserves this name.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a refusal announces itself and stands under the field it concerns', async () => {
  await openSheet();

  await nameField().fill('Con');
  await press('Create Gateway');

  const refusal = page.getByRole('alert');

  await expect.element(refusal).toHaveTextContent('Windows reserves this name.');

  const name = nameField().element();

  expect(name.closest('div')?.contains(refusal.element())).toBe(true);
  expect(refusal.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    name.getBoundingClientRect().bottom,
  );
});

test('a gateway nobody named keeps the sheet open and asks for a name', async () => {
  await openSheet();

  await press('Create Gateway');

  await expect.element(page.getByText('Give the gateway a name.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a name of nothing but spacing asks for a name too, and stores nothing', async () => {
  await openSheet();

  await nameField().fill('   ');
  await press('Create Gateway');

  await expect.element(page.getByText('Give the gateway a name.')).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a refusal neither field owns stands in the sheet, carrying what refused it', async () => {
  await openSheet(refusedSave('storage-failed', 'EACCES: permission denied, open gateways'));

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('EACCES: permission denied, open gateways');
  await expect.element(sheet()).toBeVisible();
});

test('a refusal written in the schema words reads as a sentence instead', async () => {
  await openSheet(
    refusedSave('validation-failed', '[{"code":"too_small","path":["displayName"]}]'),
  );

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('recompose cannot store this gateway as it stands.');
  await expect.element(sheet()).toBeVisible();
});

test('a port outside the accepted range keeps the sheet open and states the range', async () => {
  await openSheet();

  await nameField().fill('Codex');
  await page.getByRole('textbox', { name: 'Port' }).fill('80');
  await press('Create Gateway');

  await expect.element(page.getByText('Accepts 1024 through 65535.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a name a stored gateway holds keeps the sheet open and names that gateway', async () => {
  await openSheet({ gateways: [codex] });

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect
    .element(page.getByText('Another gateway already holds the name "Codex".'))
    .toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toHaveLength(1);
});

test('a name sharing no letter with the one it collides with still names that one', async () => {
  const chineseGateway = gatewaySeed({ slug: 'gateway', displayName: '网关', port: 51234 });

  await openSheet({ gateways: [chineseGateway] });

  await nameField().fill('関門');
  await press('Create Gateway');

  await expect
    .element(page.getByText('Another gateway already holds the name "网关".'))
    .toBeVisible();
  expect(await storedGateways()).toHaveLength(1);
});

test('a port a stored gateway holds names the gateway holding it', async () => {
  await openSheet({ gateways: [codex] });

  await nameField().fill('Gemini');
  await page.getByRole('textbox', { name: 'Port' }).fill('51234');
  await press('Create Gateway');

  await expect.element(page.getByText('codex already holds this port.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
});

test('a refusal clears once the person changes the field it concerns', async () => {
  await openSheet();

  await nameField().fill('Con');
  await press('Create Gateway');

  await expect.element(page.getByText('Windows reserves this name.')).toBeVisible();

  await nameField().fill('Console');

  await expect.element(page.getByText('Windows reserves this name.')).not.toBeInTheDocument();
});

test('a probe that cannot find a free port leaves the field empty rather than guessing', async () => {
  await openSheet({
    overrides: {
      'gateways:offer-port': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'the free-port probe failed' },
        }),
    },
  });

  await expect.element(page.getByRole('textbox', { name: 'Port' })).toHaveValue('');
});

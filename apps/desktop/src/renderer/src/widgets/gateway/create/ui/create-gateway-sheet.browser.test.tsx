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

  return <CreateGatewaySheet onOpenChange={setOpen} open={open} />;
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

test('the sheet opens with focus in the name field, ready to be typed into', async () => {
  await openSheet();

  await expect.element(page.getByRole('textbox', { name: 'Name' })).toHaveFocus();
});

test('the port field arrives holding a free port, and the preview carries it', async () => {
  await openSheet();

  await expect.element(page.getByRole('textbox', { name: 'Port' })).toHaveValue('51234');
  await expect.element(sheet()).toHaveTextContent('http://localhost:51234');
});

test('the offered port skips a port a stored gateway already holds', async () => {
  await openSheet({ gateways: [codex] });

  await expect.element(page.getByRole('textbox', { name: 'Port' })).toHaveValue('51235');
});

test('the preview follows the port field on every keystroke', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Port' }).fill('9000');

  await expect.element(sheet()).toHaveTextContent('http://localhost:9000');
});

test('an empty port field previews no port rather than half an address', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Port' }).fill('');

  await expect.element(sheet()).toHaveTextContent('http://localhost');
});

test('accepting what the sheet offers stores the gateway and hands the screen back', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('codex');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toMatchObject([
    { slug: 'codex', displayName: 'Codex', port: 51234 },
  ]);
});

test('a port a person typed themselves beats the one the sheet offered', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('codex');
  await page.getByRole('textbox', { name: 'Port' }).fill('9000');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toMatchObject([{ slug: 'codex', port: 9000 }]);
});

test('a gateway saves with no virtual model, because a person names one before composing', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('codex');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect((await storedGateways())[0]?.virtualModels).toEqual([]);
});

test('a slug the format refuses keeps the sheet open and states the format', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('Codex');
  await press('Create Gateway');

  await expect
    .element(page.getByText('Accepts lowercase letters, digits, and single dashes.'))
    .toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a slug ending in a dash meets the same refusal', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('codex-');
  await press('Create Gateway');

  await expect
    .element(page.getByText('Accepts lowercase letters, digits, and single dashes.'))
    .toBeVisible();
});

test('a name Windows keeps for a device keeps the sheet open and says so', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Console');
  await page.getByRole('textbox', { name: 'Slug' }).fill('con');
  await press('Create Gateway');

  await expect.element(page.getByText('Windows reserves this name.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
});

test('a port outside the accepted range keeps the sheet open and states the range', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('codex');
  await page.getByRole('textbox', { name: 'Port' }).fill('80');
  await press('Create Gateway');

  await expect.element(page.getByText('Accepts 1024 through 65535.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a slug a stored gateway holds keeps the sheet open under the slug field', async () => {
  await openSheet({ gateways: [codex] });

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex again');
  await page.getByRole('textbox', { name: 'Slug' }).fill('codex');
  await press('Create Gateway');

  await expect.element(page.getByText('Another gateway holds this slug.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toHaveLength(1);
});

test('a port a stored gateway holds names the gateway holding it', async () => {
  await openSheet({ gateways: [codex] });

  await page.getByRole('textbox', { name: 'Name' }).fill('Gemini');
  await page.getByRole('textbox', { name: 'Slug' }).fill('gemini');
  await page.getByRole('textbox', { name: 'Port' }).fill('51234');
  await press('Create Gateway');

  await expect.element(page.getByText('codex already holds this port.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
});

test('a refusal clears once the person changes the field it concerns', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await page.getByRole('textbox', { name: 'Slug' }).fill('Codex');
  await press('Create Gateway');

  await expect
    .element(page.getByText('Accepts lowercase letters, digits, and single dashes.'))
    .toBeVisible();

  await page.getByRole('textbox', { name: 'Slug' }).fill('codex');

  await expect
    .element(page.getByText('Accepts lowercase letters, digits, and single dashes.'))
    .not.toBeInTheDocument();
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

test('cancelling hands the screen back without storing anything', async () => {
  await openSheet();

  await page.getByRole('textbox', { name: 'Name' }).fill('Codex');
  await press('Cancel');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toEqual([]);
});

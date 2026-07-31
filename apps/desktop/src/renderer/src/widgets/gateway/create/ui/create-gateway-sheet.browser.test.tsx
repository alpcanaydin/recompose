import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { CreateGatewaySheet } from './create-gateway-sheet';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

function SheetHarness({ onCreated }: { onCreated: (slug: string) => void }) {
  const [open, setOpen] = useState(true);

  return <CreateGatewaySheet onCreated={onCreated} onOpenChange={setOpen} open={open} />;
}

async function openSheet(
  parameters: BridgeParameters = {},
  onCreated: (slug: string) => void = () => {},
) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <SheetHarness onCreated={onCreated} />
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

test('the sheet opens with focus in the name field, ready to be typed into', async () => {
  await openSheet();

  await expect.element(nameField()).toHaveFocus();
});

test('the sheet asks for a name and a port, and never for a slug', async () => {
  await openSheet();

  await expect.element(page.getByRole('textbox', { name: 'Slug' })).not.toBeInTheDocument();
  await expect.element(nameField()).toBeVisible();
  await expect.element(page.getByRole('textbox', { name: 'Port' })).toBeVisible();
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

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toMatchObject([
    { slug: 'codex', displayName: 'Codex', port: 51234 },
  ]);
});

test('a name of several words stores under the slug the app derives from it', async () => {
  await openSheet();

  await nameField().fill('My Gateway');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toMatchObject([{ slug: 'my-gateway', displayName: 'My Gateway' }]);
});

test('a name whose letters no slug can carry still stores, under a slug that stands in', async () => {
  await openSheet();

  await nameField().fill('网关');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toMatchObject([{ slug: 'gateway', displayName: '网关' }]);
});

test('a port a person typed themselves beats the one the sheet offered', async () => {
  await openSheet();

  await nameField().fill('Codex');
  await page.getByRole('textbox', { name: 'Port' }).fill('9000');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toMatchObject([{ slug: 'codex', port: 9000 }]);
});

test('a gateway saves with no virtual model, because a person names one before composing', async () => {
  await openSheet();

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect((await storedGateways())[0]?.virtualModels).toEqual([]);
});

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

test('a port outside the accepted range keeps the sheet open and states the range', async () => {
  await openSheet();

  await nameField().fill('Codex');
  await page.getByRole('textbox', { name: 'Port' }).fill('80');
  await press('Create Gateway');

  await expect.element(page.getByText('Accepts 1024 through 65535.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
  expect(await storedGateways()).toEqual([]);
});

test('a name a stored gateway holds keeps the sheet open under the name field', async () => {
  await openSheet({ gateways: [codex] });

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect.element(page.getByText('Another gateway holds this name.')).toBeVisible();
  await expect.element(sheet()).toBeVisible();
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

test('cancelling hands the screen back without storing anything', async () => {
  await openSheet();

  await nameField().fill('Codex');
  await press('Cancel');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(await storedGateways()).toEqual([]);
});

test('a stored gateway hands its slug back so the screen can follow it', async () => {
  const followed: string[] = [];

  await openSheet({}, (slug) => {
    followed.push(slug);
  });

  await nameField().fill('My Gateway');
  await press('Create Gateway');

  await expect.element(sheet()).not.toBeInTheDocument();
  expect(followed).toEqual(['my-gateway']);
});

test('a refused save hands no slug back, because nothing was stored', async () => {
  const followed: string[] = [];

  await openSheet({ gateways: [codex] }, (slug) => {
    followed.push(slug);
  });

  await nameField().fill('Codex');
  await press('Create Gateway');

  await expect.element(sheet()).toBeVisible();
  expect(followed).toEqual([]);
});

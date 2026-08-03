import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BrandMarkName } from '../../../shared/ui';

import { installFakeBridge } from '../../../shared/testing';
import { ConnectKeyForm } from './connect-key-form';

function KeyForm({ provider }: { provider: BrandMarkName }) {
  const [connected, setConnected] = useState(false);

  return connected ? (
    <p>The form stepped aside.</p>
  ) : (
    <ConnectKeyForm
      kind="api-key"
      provider={provider}
      onConnected={() => {
        setConnected(true);
      }}
    />
  );
}

async function renderKeyForm(provider: BrandMarkName = 'anthropic') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <KeyForm provider={provider} />
    </QueryClientProvider>,
  );
}

async function storedAccounts() {
  const answer = await window.recompose['accounts:list']();

  return answer.ok ? answer.value.accounts : [];
}

test('a key form asks for a name and a key, and nothing the picked entry already settled', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await expect.element(screen.getByLabelText('Name')).toBeVisible();
  await expect.element(screen.getByLabelText('Key')).toBeVisible();
  await expect.element(screen.getByLabelText('Provider')).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('Base URL')).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('Dialect')).not.toBeInTheDocument();
});

test('the form names the host the key will be spent against before it is stored', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await expect.element(screen.getByText('api.anthropic.com')).toBeVisible();
});

test('a connect stores the name the person gave under the provider the entry carried', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await screen.getByLabelText('Name').fill('build');
  await screen.getByLabelText('Key').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('The form stepped aside.')).toBeVisible();
  expect(await storedAccounts()).toMatchObject([
    { provider: 'anthropic', kind: 'api-key', label: 'build' },
  ]);
});

test('a key with no name has nothing to connect, because the name is what tells two keys apart', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await screen.getByLabelText('Key').fill('sk-supersecret');

  await expect.element(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();

  await screen.getByLabelText('Name').fill('build');

  await expect.element(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
});

test('a key shaped like another vendor warns about the shape and still connects', async () => {
  installFakeBridge();

  const screen = await renderKeyForm('openai');

  await screen.getByLabelText('Name').fill('build');
  await screen.getByLabelText('Key').fill('sk-ant-api03-supersecret');

  await expect.element(screen.getByRole('status')).toHaveTextContent('Anthropic');

  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('The form stepped aside.')).toBeVisible();
});

test('a key shaped like the provider it was picked for draws no warning at all', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await screen.getByLabelText('Key').fill('sk-ant-api03-supersecret');

  await expect.element(screen.getByLabelText('Key')).toHaveValue('sk-ant-api03-supersecret');
  await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
});

test('a key the person typed never reaches the screen it was typed into', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await screen.getByLabelText('Key').fill('sk-supersecret');

  await expect.element(screen.getByLabelText('Key')).toHaveAttribute('type', 'password');
  await expect.element(screen.getByText('sk-supersecret')).not.toBeInTheDocument();
});

test('a connect still out cannot be sent a second time, so one key makes one account', async () => {
  installFakeBridge({
    overrides: {
      'accounts:connect': async () => new Promise<never>(() => undefined),
    },
  });

  const screen = await renderKeyForm();

  await screen.getByLabelText('Name').fill('build');
  await screen.getByLabelText('Key').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
});

test('a connect refused for its name says why and keeps both drafts the person typed', async () => {
  installFakeBridge({
    overrides: {
      'accounts:connect': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'name-conflict', message: 'Anthropic API already holds a key "build".' },
        }),
    },
  });

  const screen = await renderKeyForm();

  await screen.getByLabelText('Name').fill('build');
  await screen.getByLabelText('Key').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Anthropic API already holds a key "build".');
  await expect.element(screen.getByLabelText('Name')).toHaveValue('build');
  await expect.element(screen.getByLabelText('Key')).toHaveValue('sk-supersecret');
});

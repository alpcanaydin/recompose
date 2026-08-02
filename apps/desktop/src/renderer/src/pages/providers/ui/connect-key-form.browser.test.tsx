import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { installFakeBridge } from '../../../shared/testing';
import { ConnectKeyForm } from './connect-key-form';

function KeyForm() {
  const [connected, setConnected] = useState(false);

  return connected ? (
    <p>The form stepped aside.</p>
  ) : (
    <ConnectKeyForm
      kind="api-key"
      provider="anthropic"
      onConnected={() => {
        setConnected(true);
      }}
    />
  );
}

async function renderKeyForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <KeyForm />
    </QueryClientProvider>,
  );
}

async function storedAccounts() {
  const answer = await window.recompose['accounts:list']();

  return answer.ok ? answer.value.accounts : [];
}

test('a key form connects the provider it was opened for, without asking who it is', async () => {
  installFakeBridge();

  const screen = await renderKeyForm();

  await expect.element(screen.getByLabelText('Provider')).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('Label')).not.toBeInTheDocument();
  await screen.getByLabelText('Key').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByText('The form stepped aside.')).toBeVisible();
  expect(await storedAccounts()).toMatchObject([
    { provider: 'anthropic', kind: 'api-key', label: 'Anthropic' },
  ]);
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

  await screen.getByLabelText('Key').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect.element(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
});

test('a refused connect says why and keeps the draft the person typed', async () => {
  installFakeBridge({
    overrides: {
      'accounts:connect': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'vault-unavailable', message: 'OS secret encryption is unavailable.' },
        }),
    },
  });

  const screen = await renderKeyForm();

  await screen.getByLabelText('Key').fill('sk-supersecret');
  await screen.getByRole('button', { name: 'Connect' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('OS secret encryption is unavailable.');
  await expect.element(screen.getByLabelText('Key')).toHaveValue('sk-supersecret');
});

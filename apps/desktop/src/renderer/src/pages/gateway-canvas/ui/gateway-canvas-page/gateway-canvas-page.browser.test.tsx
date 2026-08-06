import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { beforeEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { inspectorOpen, toggleInspector } from '../../../../shared/lib';
import { installFakeBridge } from '../../../../shared/testing';
import {
  freshGateway,
  listedModels,
  runningGateway,
  servingGateway,
  storedAccounts,
} from '../../testing/gateway-canvas.testkit';
import { GatewayCanvasPage } from './gateway-canvas-page';

async function renderPage(gateway = servingGateway) {
  installFakeBridge({
    accounts: storedAccounts,
    gateways: [gateway],
    engineStates: runningGateway,
    providerModels: listedModels,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <GatewayCanvasPage slug="my-gateway" />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  if (!inspectorOpen()) {
    toggleInspector();
  }
});

test('the gateway lands with its node selected and its inspector open', async () => {
  const screen = await renderPage();

  await expect.element(screen.getByText('Endpoint', { exact: true })).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: /My Gateway/ }))
    .toHaveAttribute('aria-pressed', 'true');
});

test('clicking the selected node closes the inspector and leaves the stage standing', async () => {
  const screen = await renderPage();

  await userEvent.click(screen.getByRole('button', { name: /My Gateway/ }));

  await expect.element(screen.getByText('Endpoint', { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText('Virtual models serve from the drawer')).toBeVisible();
});

test('the closing inspector stays for its exit rather than cutting out on the click', async () => {
  const screen = await renderPage();

  await userEvent.click(screen.getByRole('button', { name: /My Gateway/ }));

  expect(screen.container.textContent).toContain('Endpoint');

  await expect.element(screen.getByText('Endpoint', { exact: true })).not.toBeInTheDocument();
});

test('clicking the node again opens the inspector back up', async () => {
  const screen = await renderPage();

  await userEvent.click(screen.getByRole('button', { name: /My Gateway/ }));
  await userEvent.click(screen.getByRole('button', { name: /My Gateway/ }));

  await expect.element(screen.getByText('Endpoint', { exact: true })).toBeVisible();
});

test('a draft in flight survives closing the inspector and comes back as it was', async () => {
  const screen = await renderPage(freshGateway);

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast Sonnet');

  await userEvent.click(screen.getByRole('button', { name: /My Gateway/ }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /My Gateway/ }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fast Sonnet');
});

test('a draft a person left behind is gone when the flow is opened again', async () => {
  const screen = await renderPage(freshGateway);

  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast Sonnet');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));

  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
});

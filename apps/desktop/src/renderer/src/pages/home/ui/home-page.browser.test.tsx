import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../shared/testing';

import { engineStatesQueryOptions, gatewaysQueryOptions } from '../../../shared/api';
import { gatewaySeed, installFakeBridge } from '../../../shared/testing';
import { HomePage } from './home-page';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const noop = () => {};

const bodyCopy =
  'A gateway is one local address that routes requests across your AI accounts. Everything stays on this machine.';

type HomeOptions = {
  providerConnected?: boolean;
  restoreRequest?: string;
  onCreateGateway?: () => void;
};

async function renderHome(parameters: BridgeParameters, options: HomeOptions = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await Promise.all([
    queryClient.ensureQueryData(gatewaysQueryOptions),
    queryClient.ensureQueryData(engineStatesQueryOptions),
  ]);

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <HomePage
          onCreateGateway={options.onCreateGateway ?? noop}
          providerConnected={options.providerConnected ?? false}
          restoreRequest={options.restoreRequest}
        />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('a fresh install invites the first gateway rather than showing an empty surface', async () => {
  const screen = await renderHome({ gateways: [] });

  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway', level: 1 }))
    .toBeVisible();
  await expect.element(screen.getByText(bodyCopy)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Create Gateway' })).toBeVisible();
});

test('the call to action asks for the creation sheet', async () => {
  const onCreateGateway = vi.fn<() => void>();
  const screen = await renderHome({ gateways: [] }, { onCreateGateway });

  await screen.getByRole('button', { name: 'Create Gateway' }).click();

  expect(onCreateGateway).toHaveBeenCalledTimes(1);
});

test('the invitation leaves once a gateway exists', async () => {
  const screen = await renderHome({ gateways: [codex] });

  await expect.element(screen.getByRole('heading', { name: 'Get started' })).toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'Create your first gateway' }))
    .not.toBeInTheDocument();
});

test('the checklist names all four steps of a first session', async () => {
  const screen = await renderHome({ gateways: [] });

  await expect.element(screen.getByText('Create a gateway')).toBeVisible();
  await expect.element(screen.getByText('Connect a provider')).toBeVisible();
  await expect.element(screen.getByText('Compose a virtual model')).toBeVisible();
  await expect.element(screen.getByText('Send the first request')).toBeVisible();
});

test('the checklist stands on the step the session has reached', async () => {
  const screen = await renderHome({ gateways: [] });

  await expect
    .element(screen.getByText('Create a gateway'))
    .toHaveAttribute('aria-current', 'step');
  await expect.element(screen.getByText('Connect a provider')).not.toHaveAttribute('aria-current');
});

test('a finished step hands the current mark to the next one', async () => {
  const screen = await renderHome({ gateways: [codex] });

  await expect
    .element(screen.getByText('Connect a provider'))
    .toHaveAttribute('aria-current', 'step');
  await expect.element(screen.getByText('Create a gateway')).not.toHaveAttribute('aria-current');
});

test('a stored gateway and a connected account move the checklist past both', async () => {
  const screen = await renderHome({ gateways: [codex] }, { providerConnected: true });

  await expect.element(screen.getByText('Create a gateway')).toBeVisible();
  await expect.element(screen.getByText('Waits on the canvas.')).toBeVisible();
  await expect.element(screen.getByText('Waits on a virtual model.')).toBeVisible();
});

test('the two steps this build cannot finish name what they wait for', async () => {
  const screen = await renderHome({ gateways: [] });

  await expect.element(screen.getByText('Waits on the canvas.')).toBeVisible();
  await expect.element(screen.getByText('Waits on a virtual model.')).toBeVisible();
});

test('skipping the setup takes the card away', async () => {
  const screen = await renderHome({ gateways: [codex] });

  await screen.getByRole('button', { name: 'Skip setup' }).click();

  await expect
    .element(screen.getByRole('heading', { name: 'Get started' }))
    .not.toBeInTheDocument();
});

test('a card the person skipped stays away on the next visit', async () => {
  const first = await renderHome({ gateways: [codex] });

  await first.getByRole('button', { name: 'Skip setup' }).click();

  await expect.element(first.getByRole('heading', { name: 'Get started' })).not.toBeInTheDocument();

  await first.unmount();

  const second = await renderHome({ gateways: [] });

  await expect
    .element(second.getByRole('heading', { name: 'Create your first gateway' }))
    .toBeVisible();
  await expect
    .element(second.getByRole('heading', { name: 'Get started' }))
    .not.toBeInTheDocument();
});

test('asking for the card again brings it back', async () => {
  const first = await renderHome({ gateways: [codex] });

  await first.getByRole('button', { name: 'Skip setup' }).click();

  await expect.element(first.getByRole('heading', { name: 'Get started' })).not.toBeInTheDocument();

  await first.unmount();

  const second = await renderHome({ gateways: [codex] }, { restoreRequest: '7' });

  await expect.element(second.getByRole('heading', { name: 'Get started' })).toBeVisible();
});

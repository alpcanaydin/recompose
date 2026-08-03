import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { beforeEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import type { BridgeParameters } from '../../../shared/testing';

import { accountsQueryOptions, gatewaysQueryOptions } from '../../../shared/api';
import { gatewaySeed, installFakeBridge } from '../../../shared/testing';
import { GetStartedPanel } from './get-started-panel';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

async function renderPanel(parameters: BridgeParameters = {}, restoreRequest?: string) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await Promise.all([
    queryClient.ensureQueryData(gatewaysQueryOptions),
    queryClient.ensureQueryData(accountsQueryOptions),
  ]);

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <GetStartedPanel restoreRequest={restoreRequest} />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

test('the checklist names all four steps of a first session', async () => {
  const screen = await renderPanel();

  await expect.element(screen.getByText('Create a gateway')).toBeVisible();
  await expect.element(screen.getByText('Connect a provider')).toBeVisible();
  await expect.element(screen.getByText('Compose a virtual model')).toBeVisible();
  await expect.element(screen.getByText('Send the first request')).toBeVisible();
});

test('the checklist stands on the step the session has reached', async () => {
  const screen = await renderPanel({ gateways: [codex] });

  await expect
    .element(screen.getByText('Connect a provider'))
    .toHaveAttribute('aria-current', 'step');
});

test('folding the checklist keeps its header and its progress and drops the rest', async () => {
  const screen = await renderPanel({ gateways: [codex] });

  await screen.getByRole('button', { name: 'Get started' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Get started' })).toBeVisible();
  await expect.element(screen.getByText('1 of 4')).toBeVisible();
  await expect.element(screen.getByText('Create a gateway')).not.toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Skip setup' })).not.toBeInTheDocument();
});

test('the fold reports itself, so the header says whether the steps are showing', async () => {
  const screen = await renderPanel();

  const header = screen.getByRole('button', { name: 'Get started' });

  await expect.element(header).toHaveAttribute('aria-expanded', 'true');

  await header.click();

  await expect.element(header).toHaveAttribute('aria-expanded', 'false');
});

test('a checklist folded away comes back folded on the next session', async () => {
  const first = await renderPanel({ gateways: [codex] });

  await first.getByRole('button', { name: 'Get started' }).click();

  await expect.element(first.getByText('Create a gateway')).not.toBeVisible();

  await first.unmount();

  const second = await renderPanel({ gateways: [codex] });

  await expect.element(second.getByRole('heading', { name: 'Get started' })).toBeVisible();
  await expect.element(second.getByText('Create a gateway')).not.toBeVisible();
});

test('opening a folded checklist brings its steps back for good', async () => {
  const first = await renderPanel({ gateways: [codex] });
  const header = first.getByRole('button', { name: 'Get started' });

  await header.click();
  await header.click();

  await expect.element(first.getByText('Create a gateway')).toBeVisible();

  await first.unmount();

  const second = await renderPanel({ gateways: [codex] });

  await expect.element(second.getByText('Create a gateway')).toBeVisible();
});

test('skipping the setup takes the whole checklist away', async () => {
  const screen = await renderPanel({ gateways: [codex] });

  await screen.getByRole('button', { name: 'Skip setup' }).click();

  await expect
    .element(screen.getByRole('heading', { name: 'Get started' }))
    .not.toBeInTheDocument();
});

test('a checklist the person skipped stays away on the next session', async () => {
  const first = await renderPanel({ gateways: [codex] });

  await first.getByRole('button', { name: 'Skip setup' }).click();
  await first.unmount();

  const second = await renderPanel({ gateways: [codex] });

  await expect
    .element(second.getByRole('heading', { name: 'Get started' }))
    .not.toBeInTheDocument();
});

test('asking for the checklist again brings it back', async () => {
  const first = await renderPanel({ gateways: [codex] });

  await first.getByRole('button', { name: 'Skip setup' }).click();
  await first.unmount();

  const second = await renderPanel({ gateways: [codex] }, '7');

  await expect.element(second.getByRole('heading', { name: 'Get started' })).toBeVisible();
});

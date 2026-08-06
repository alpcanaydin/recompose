import type { AccountsDocument } from '@recompose/contracts';

import { expect, test } from 'vitest';

import {
  gatewaySeed,
  noAccounts,
  subscriptionOnlyAccounts as subscriptionOnly,
} from '../../shared/testing';
import { renderAt } from '../testing/render-app';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

async function openTheAddFlow(accounts: AccountsDocument) {
  const screen = await renderAt('/gateways/codex', { accounts, gateways: [codex] });

  await screen.getByRole('button', { name: 'Add virtual model' }).click();

  return screen;
}

test('with nothing stored that can serve, the target says so instead of offering nothing', async () => {
  const screen = await openTheAddFlow(noAccounts);

  await expect.element(screen.getByText('No account can serve yet')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Open Providers' })).toBeVisible();
  await expect
    .element(screen.getByRole('searchbox', { name: 'Search accounts' }))
    .not.toBeInTheDocument();
});

test('a registry whose accounts none of them can serve lands in the same empty target', async () => {
  const screen = await openTheAddFlow(subscriptionOnly);

  await expect.element(screen.getByText('No account can serve yet')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Open Providers' })).toBeVisible();
});

test('the way out of the empty target reaches the screen that connects one', async () => {
  const screen = await openTheAddFlow(subscriptionOnly);

  await screen.getByRole('link', { name: 'Open Providers' }).click();

  await expect.element(screen.getByRole('heading', { name: 'API Keys' })).toBeVisible();
});

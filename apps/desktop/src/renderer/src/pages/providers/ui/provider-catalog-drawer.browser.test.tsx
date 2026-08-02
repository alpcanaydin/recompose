import type { SubscriptionTool } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { installFakeBridge } from '../../../shared/testing';
import { ProviderCatalogDrawer } from './provider-catalog-drawer';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

function Catalog() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <p>{open ? 'The screen behind stands.' : 'The catalog closed.'}</p>
      <button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        Add provider again
      </button>
      <ProviderCatalogDrawer onOpenChange={setOpen} open={open} />
    </>
  );
}

async function renderCatalog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <Catalog />
      </Suspense>
    </QueryClientProvider>,
  );
}

async function press(name: string) {
  const control = page.getByRole('button', { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

test('the catalog opens beside the screen rather than replacing it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await expect.element(screen.getByRole('dialog', { name: 'Add provider' })).toBeVisible();
  await expect.element(screen.getByText('The screen behind stands.')).toBeVisible();
});

test('the catalog gathers its providers under the way each one connects', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await expect.element(screen.getByRole('heading', { name: 'Subscriptions' })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'Aggregators' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'OpenRouter' })).toBeVisible();
});

test('narrowing the catalog to subscriptions leaves only the providers that sign in', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await press('Subscriptions');

  await expect.element(screen.getByRole('button', { name: 'Anthropic' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'OpenRouter' })).not.toBeInTheDocument();
});

test('a search narrows the catalog to the providers whose name carries it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await screen.getByRole('textbox', { name: 'Search providers' }).fill('rout');

  await expect.element(screen.getByRole('button', { name: 'OpenRouter' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Anthropic' })).not.toBeInTheDocument();
});

test('a search nothing answers says so rather than leaving the catalog blank', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await screen.getByRole('textbox', { name: 'Search providers' }).fill('zzz');

  await expect.element(screen.getByText(/No provider matches/)).toBeVisible();
});

test('picking a provider stands its ways where the list was', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await press('Anthropic');

  await expect
    .element(screen.getByRole('heading', { name: 'An account for Claude Code' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'A target a gateway can reach' }))
    .toBeVisible();
});

test('a provider picked by mistake hands the catalog back', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await press('Anthropic');
  await press('All providers');

  await expect.element(screen.getByRole('button', { name: 'OpenRouter' })).toBeVisible();
});

test('a catalog opened again stands on the whole list, not on the last search', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await screen.getByRole('textbox', { name: 'Search providers' }).fill('rout');
  await press('Close');
  await press('Add provider again');

  await expect.element(screen.getByRole('textbox', { name: 'Search providers' })).toHaveValue('');
  await expect.element(screen.getByRole('button', { name: 'Anthropic' })).toBeVisible();
});

test('a catalog opened again stands on the whole list, not on the last chip', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await press('Subscriptions');
  await press('Close');
  await press('Add provider again');

  await expect.element(screen.getByRole('button', { name: 'OpenRouter' })).toBeVisible();
});

test('an account the catalog connected closes it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog();

  await press('Anthropic');
  await press('Sign in to Anthropic');

  await expect.element(screen.getByText('The catalog closed.')).toBeVisible();
});

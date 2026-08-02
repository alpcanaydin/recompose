import type { SubscriptionTool } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { AccountKind } from '../../../entities/account';

import { installFakeBridge } from '../../../shared/testing';
import { ProviderCatalogSheet } from './provider-catalog-sheet';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

function Catalog({ kind }: { kind: AccountKind }) {
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
      <ProviderCatalogSheet kind={kind} onOpenChange={setOpen} open={open} />
    </>
  );
}

async function renderCatalog(kind: AccountKind = 'subscription') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <Catalog kind={kind} />
      </Suspense>
    </QueryClientProvider>,
  );
}

async function press(name: RegExp | string) {
  const control = page.getByRole('button', { name });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

test('the catalog opens as a modal holding only the kind the screen asked for', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  await expect.element(screen.getByRole('dialog', { name: 'Add provider' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Claude/ })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Codex/ })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /OpenRouter/ })).not.toBeInTheDocument();
});

test('a subscription row reads as the plan product and what signing in gives', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  await expect
    .element(screen.getByRole('button', { name: /Claude/ }))
    .toHaveTextContent('Sign in with your Pro or Max plan');
});

test('the plans the release does not connect yet stand disabled rather than hidden', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  const copilot = screen.getByRole('button', { name: /GitHub Copilot/ });

  await expect.element(copilot).toBeVisible();
  await expect.element(copilot).toHaveAttribute('aria-disabled', 'true');
});

test('the keys screen catalog reads each row as the endpoint the key is spent against', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('api-key');

  await expect.element(screen.getByRole('button', { name: /Anthropic API/ })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /OpenAI API/ })).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: /GitHub Copilot/ }))
    .not.toBeInTheDocument();
});

test('the local screen catalog names the servers that will connect later, all disabled', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('local');

  await expect
    .element(screen.getByRole('button', { name: /Ollama/ }))
    .toHaveAttribute('aria-disabled', 'true');
});

test('picking a provider stands its one way where the grid was', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  await press(/^Claude/);

  await expect
    .element(screen.getByRole('heading', { name: 'An account for Claude Code' }))
    .toBeVisible();
  await expect
    .element(screen.getByRole('heading', { name: 'A target a gateway can reach' }))
    .not.toBeInTheDocument();
});

test('a provider picked by mistake hands the catalog back', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  await press(/^Claude/);
  await press('Back');

  await expect.element(screen.getByRole('button', { name: /Codex/ })).toBeVisible();
});

test('a catalog opened again stands on the whole grid, not on the last pick', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  await press(/^Claude/);
  await press('Cancel');
  await press('Add provider again');

  await expect.element(screen.getByRole('button', { name: /Codex/ })).toBeVisible();
});

test('an account the catalog connected closes it', async () => {
  installFakeBridge({ tools: [claudeCode] });

  const screen = await renderCatalog('subscription');

  await press(/^Claude/);
  await press('Sign in to Anthropic');

  await expect.element(screen.getByText('The catalog closed.')).toBeVisible();
});

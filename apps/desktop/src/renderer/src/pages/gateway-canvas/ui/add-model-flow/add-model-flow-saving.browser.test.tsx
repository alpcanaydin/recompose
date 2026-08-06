import type { AccountsDocument, VirtualModel } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { AddModelFlow } from './add-model-flow';

const everyKind: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    { id: 'k1', provider: 'anthropic', kind: 'api-key', label: 'work', credentialRef: 'c1' },
    {
      id: 'g1',
      provider: 'openrouter',
      kind: 'aggregator',
      label: 'openrouter',
      credentialRef: 'c2',
    },
  ],
};

const listed = { k1: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'] };

async function renderFlow(
  parameters: BridgeParameters = {},
  held: readonly VirtualModel[] = [],
  onBack: () => void = () => {},
) {
  const gateway = gatewaySeed({
    slug: 'my-gateway',
    displayName: 'My Gateway',
    port: 8397,
    virtualModels: held,
  });

  installFakeBridge({ accounts: everyKind, gateways: [gateway], ...parameters });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading…</p>}>
        <AddModelFlow gateway={gateway} onBack={onBack} />
      </Suspense>
    </QueryClientProvider>,
  );
}

async function settleADraft(screen: Awaited<ReturnType<typeof renderFlow>>, named: string) {
  await screen.getByRole('textbox', { name: 'Name' }).fill(named);
  await userEvent.click(screen.getByRole('button', { name: /work/ }));
  await userEvent.click(screen.getByRole('button', { name: 'claude-haiku-4-5' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));
}

async function storedDefinitions(): Promise<readonly VirtualModel[]> {
  const stored = await window.recompose['gateways:list']();

  return stored.ok ? (stored.value[0]?.virtualModels ?? []) : [];
}

test('a settled draft lands on the stored gateway and hands the drawer back', async () => {
  const left: string[] = [];

  const screen = await renderFlow({ providerModels: listed }, [], () => {
    left.push('back');
  });

  await settleADraft(screen, 'Fast');

  await expect.poll(() => left).toEqual(['back']);
  await expect.poll(storedDefinitions).toEqual([
    {
      id: 'fast',
      displayName: 'Fast',
      target: { accountId: 'k1', providerModel: 'claude-haiku-4-5' },
    },
  ]);
});

test('a definition joins the ones the gateway already serves rather than replacing them', async () => {
  const held: VirtualModel = {
    id: 'slow',
    displayName: 'Slow',
    target: { accountId: 'k1', providerModel: 'claude-opus-5' },
  };

  const screen = await renderFlow({ providerModels: listed }, [held]);

  await settleADraft(screen, 'Fast');

  await expect
    .poll(async () => (await storedDefinitions()).map((model) => model.id))
    .toEqual(['slow', 'fast']);
});

test('a gateway main no longer holds keeps the draft standing and says why', async () => {
  const screen = await renderFlow({ providerModels: listed, gateways: [] });

  await settleADraft(screen, 'Fast');

  await expect.element(screen.getByRole('alert')).toHaveTextContent(/stores no gateway/);
  await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fast');
});

test('a save the disk refuses reads the words main wrote, rather than changing nothing', async () => {
  const screen = await renderFlow({
    providerModels: listed,
    overrides: {
      'gateways:update': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'EACCES: permission denied, open gateways' },
        }),
    },
  });

  await settleADraft(screen, 'Fast');

  await expect.element(screen.getByText('EACCES: permission denied, open gateways')).toBeVisible();
});

test('a save the stored shape refuses trades developer words for a sentence', async () => {
  const screen = await renderFlow({
    providerModels: listed,
    overrides: {
      'gateways:update': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'validation-failed', message: 'invalid_type at virtualModels[0].id' },
        }),
    },
  });

  await settleADraft(screen, 'Fast');

  await expect
    .element(screen.getByText('recompose cannot store this virtual model as it stands.'))
    .toBeVisible();
});

test('a model list main refused reads those words where the models would stand', async () => {
  const screen = await renderFlow({
    overrides: {
      'accounts:list-models': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'the account registry could not be read' },
        }),
    },
  });

  await userEvent.click(screen.getByRole('button', { name: /work/ }));

  await expect.element(screen.getByText('the account registry could not be read')).toBeVisible();
});

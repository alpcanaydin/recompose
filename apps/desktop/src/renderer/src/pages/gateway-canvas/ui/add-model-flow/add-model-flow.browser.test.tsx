import type { AccountsDocument, VirtualModel } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { gatewaySeed, installFakeBridge } from '../../../../shared/testing';
import { emptyDefinition } from '../../lib/model-draft';
import { AddModelFlow } from './add-model-flow';

const everyKind: AccountsDocument = {
  schemaVersion: ACCOUNTS_VERSION,
  accounts: [
    { id: 's1', provider: 'anthropic', kind: 'subscription', label: 'Claude' },
    { id: 'k1', provider: 'anthropic', kind: 'api-key', label: 'work', credentialRef: 'c1' },
    {
      id: 'g1',
      provider: 'openrouter',
      kind: 'aggregator',
      label: 'openrouter',
      credentialRef: 'c2',
    },
    { id: 'l1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' },
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
        <AddModelFlow
          gateway={gateway}
          onBack={onBack}
          onKeep={() => {}}
          opening={emptyDefinition()}
        />
      </Suspense>
    </QueryClientProvider>,
  );
}

function precedes(earlier: Element, later: Element): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('the flow asks for a name, then the target it reaches, then the model it serves', async () => {
  const screen = await renderFlow();

  const name = screen.getByRole('textbox', { name: 'Name' }).element();
  const target = screen.getByText('Target', { exact: true }).element();
  const model = screen.getByText('Model', { exact: true }).element();

  expect(precedes(name, target)).toBe(true);
  expect(precedes(target, model)).toBe(true);
});

test('the target list holds the key, the aggregator and the local account', async () => {
  const screen = await renderFlow();

  await expect.element(screen.getByRole('button', { name: /work/ })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /openrouter/ })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: /Ollama/ })).toBeVisible();
});

test('a subscription account stands in the target list', async () => {
  const screen = await renderFlow();

  await expect.element(screen.getByText('API Keys', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Claude', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Subscriptions', { exact: true })).toBeVisible();
});

test('the target list gathers the accounts under the kinds they are held as', async () => {
  const screen = await renderFlow();

  await expect.element(screen.getByText('API Keys', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Subscriptions', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Aggregators', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Local Runtimes', { exact: true })).toBeVisible();
});

test('picking a target fills the model list from that account, and never with free text', async () => {
  const screen = await renderFlow({ providerModels: listed });

  await userEvent.click(screen.getByRole('button', { name: /work/ }));

  await expect.element(screen.getByRole('button', { name: 'claude-haiku-4-5' })).toBeVisible();
  await expect
    .element(screen.getByRole('textbox', { name: 'Model', exact: true }))
    .not.toBeInTheDocument();
});

test('a target whose model list nothing could read refuses where the models would stand', async () => {
  const screen = await renderFlow();

  await userEvent.click(screen.getByRole('button', { name: /work/ }));

  await expect.element(screen.getByRole('alert')).toHaveTextContent(/model list/i);
});

test('typing the name derives the model id live, keeping the dots a client will send', async () => {
  const screen = await renderFlow();

  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'GPT 5.6 Sol');

  await expect
    .element(screen.getByRole('textbox', { name: 'Model id' }))
    .toHaveValue('gpt-5.6-sol');
  await expect.element(screen.getByText(/Claude Code/)).toBeVisible();
});

test('editing the model id detaches it, so further name typing no longer overwrites it', async () => {
  const screen = await renderFlow();
  const name = screen.getByRole('textbox', { name: 'Name' });
  const modelId = screen.getByRole('textbox', { name: 'Model id' });

  await userEvent.type(name, 'Fast');
  await expect.element(modelId).toHaveValue('fast');

  await userEvent.clear(modelId);
  await userEvent.type(modelId, 'my-alias');
  await userEvent.type(name, 'er');

  await expect.element(modelId).toHaveValue('my-alias');
  await expect.element(name).toHaveValue('Faster');
});

test('the model id carries a copy affordance for the exact string a client sends', async () => {
  const written = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  const screen = await renderFlow();

  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Fast');
  await userEvent.click(screen.getByRole('button', { name: 'Copy model id' }));

  expect(written).toHaveBeenCalledWith('fast');
});

test('the footer previews the whole binding once the draft is settled', async () => {
  const screen = await renderFlow({ providerModels: listed });

  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast');
  await userEvent.click(screen.getByRole('button', { name: /work/ }));
  await userEvent.click(screen.getByRole('button', { name: 'claude-haiku-4-5' }));

  await expect
    .element(screen.getByText('serves as fast → work · claude-haiku-4-5', { exact: true }))
    .toBeVisible();
});

test('the act that stores waits until the binding is whole', async () => {
  const screen = await renderFlow({ providerModels: listed });

  await screen.getByRole('textbox', { name: 'Name' }).fill('Fast');

  await expect.element(screen.getByRole('button', { name: 'Add virtual model' })).toBeDisabled();
});

test('a long model list offers a search that narrows it to the model a person means', async () => {
  const screen = await renderFlow({
    providerModels: {
      k1: ['a-one', 'a-two', 'a-three', 'a-four', 'b-one', 'b-two', 'b-three'],
    },
  });

  await userEvent.click(screen.getByRole('button', { name: /work/ }));
  await screen.getByRole('searchbox', { name: 'Search models' }).fill('b-t');

  await expect.element(screen.getByRole('button', { name: 'b-two' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'a-one' })).not.toBeInTheDocument();
});

test('a short model list offers no search, because the whole list already stands', async () => {
  const screen = await renderFlow({ providerModels: listed });

  await userEvent.click(screen.getByRole('button', { name: /work/ }));

  await expect.element(screen.getByRole('button', { name: 'claude-opus-5' })).toBeVisible();
  await expect
    .element(screen.getByRole('searchbox', { name: 'Search models' }))
    .not.toBeInTheDocument();
});

test('a model id the gateway already serves refuses under the model id field', async () => {
  const held: VirtualModel = {
    id: 'fast',
    displayName: 'Fast',
    target: { accountId: 'k1', providerModel: 'claude-haiku-4-5' },
  };

  const screen = await renderFlow({ providerModels: listed }, [held]);

  await screen.getByRole('textbox', { name: 'Name' }).fill('fast');
  await userEvent.click(screen.getByRole('button', { name: /work/ }));
  await userEvent.click(screen.getByRole('button', { name: 'claude-haiku-4-5' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add virtual model' }));

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('already serves a virtual model');
});

test('a query typed against a long list never strands the short list that replaces it', async () => {
  const screen = await renderFlow({
    providerModels: {
      k1: ['a-one', 'a-two', 'a-three', 'a-four', 'b-one', 'b-two', 'b-three'],
      g1: ['router-one', 'router-two'],
    },
  });

  await userEvent.click(screen.getByRole('button', { name: /work/ }));
  await screen.getByRole('searchbox', { name: 'Search models' }).fill('zzz');
  await userEvent.click(screen.getByRole('button', { name: /openrouter/ }));

  await expect.element(screen.getByRole('button', { name: 'router-one' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'router-two' })).toBeVisible();
  await expect
    .element(screen.getByText('No model matches that.', { exact: true }))
    .not.toBeInTheDocument();
});

test('leaving the flow hands the drawer back without storing anything', async () => {
  const left: string[] = [];

  const screen = await renderFlow({}, [], () => {
    left.push('back');
  });

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(left).toEqual(['back']);
});

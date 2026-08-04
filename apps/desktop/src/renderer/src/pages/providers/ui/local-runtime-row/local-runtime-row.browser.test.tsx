import type { LocalAccount, RuntimeReachability } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { installFakeBridge } from '../../../../shared/testing';
import { LocalRuntimeRow } from './local-runtime-row';

const stored: LocalAccount = {
  id: 'l1',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
};

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

async function renderRow(parameters: BridgeParameters = {}, queryClient = newQueryClient()) {
  installFakeBridge({
    accounts: { schemaVersion: 4, accounts: [stored] },
    ...parameters,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <LocalRuntimeRow account={stored} />
      </ul>
    </QueryClientProvider>,
  );
}

function lookAnsweringInTurn(...readings: readonly RuntimeReachability[]) {
  let looksTaken = 0;

  return async () => {
    const reading = readings[looksTaken];

    looksTaken += 1;

    if (reading === undefined) {
      return new Promise<never>(() => undefined);
    }

    return Promise.resolve({ ok: true as const, value: reading });
  };
}

async function press(name: string) {
  const control = page.getByRole('button', { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function choose(action: string) {
  await press('Actions for Ollama');

  const item = page.getByRole('menuitem', { name: action, exact: true });

  await expect.element(item).toBeVisible();

  item.element().focus();

  await userEvent.keyboard('{Enter}');
}

test('a stored runtime reads its name over the stored address', async () => {
  const screen = await renderRow({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();

  const row = screen.getByRole('listitem').element();

  if (!(row instanceof HTMLElement)) {
    throw new Error('the runtime row did not render as a list item');
  }

  expect(row.innerText).toMatch(/^Ollama\s*http:\/\/127\.0\.0\.1:11434/);
});

test('a server that answers reads Running as of this look', async () => {
  const screen = await renderRow({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByText('Running', { exact: true })).toBeVisible();
});

test('a server that stopped reads Not running rather than an alarm', async () => {
  const screen = await renderRow({ reachability: { verdict: 'unreachable' } });

  await expect.element(screen.getByText('Not running')).toBeVisible();
  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();
});

test('another server on the port never reads as the runtime running', async () => {
  const screen = await renderRow({ reachability: { verdict: 'unrecognized', status: 404 } });

  await expect.element(screen.getByText('Another server answered')).toBeVisible();
  await expect.element(screen.getByText('Running', { exact: true })).not.toBeInTheDocument();
});

test('a look still out reads Checking rather than a standing nobody observed', async () => {
  const screen = await renderRow({
    overrides: { 'accounts:check-runtime': async () => new Promise(() => undefined) },
  });

  await expect.element(screen.getByText('Checking')).toBeVisible();
  await expect.element(screen.getByText('Running', { exact: true })).not.toBeInTheDocument();
});

test('a remount forgets the last reading and looks again', async () => {
  const queryClient = newQueryClient();
  const screen = await renderRow(
    {
      overrides: {
        'accounts:check-runtime': lookAnsweringInTurn({ verdict: 'answers', version: '0.5.1' }),
      },
    },
    queryClient,
  );

  await expect.element(screen.getByText('Running', { exact: true })).toBeVisible();

  await screen.unmount();

  const remounted = await render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <LocalRuntimeRow account={stored} />
      </ul>
    </QueryClientProvider>,
  );

  await expect.element(remounted.getByText('Checking')).toBeVisible();
  await expect.element(remounted.getByText('Running', { exact: true })).not.toBeInTheDocument();
});

test('Check again re-reads the standing without touching the stored address', async () => {
  const screen = await renderRow({
    overrides: {
      'accounts:check-runtime': lookAnsweringInTurn(
        { verdict: 'answers', version: '0.5.1' },
        { verdict: 'unreachable' },
      ),
    },
  });

  await expect.element(screen.getByText('Running', { exact: true })).toBeVisible();

  await choose('Check again');

  await expect.element(screen.getByText('Not running')).toBeVisible();
  await expect.element(screen.getByText('http://127.0.0.1:11434')).toBeVisible();
});

test('the overflow holds checking again and removal, and nothing else', async () => {
  await renderRow();

  await press('Actions for Ollama');

  await expect.element(page.getByRole('menuitem', { name: 'Check again' })).toBeVisible();
  await expect.element(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();
  await expect.poll(() => page.getByRole('menuitem').elements().length).toBe(2);
});

test('removing the runtime takes it out of the registry it was held in', async () => {
  await renderRow();

  await choose('Remove');

  await expect
    .poll(async () => {
      const registry = await window.recompose['accounts:list']();

      return registry.ok ? registry.value.accounts : undefined;
    })
    .toEqual([]);
});

test('a refused removal says why on the row rather than failing in silence', async () => {
  const screen = await renderRow({
    overrides: {
      'accounts:remove': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'recompose could not rewrite the registry.' },
        }),
    },
  });

  await choose('Remove');

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('recompose could not rewrite the registry.');
});

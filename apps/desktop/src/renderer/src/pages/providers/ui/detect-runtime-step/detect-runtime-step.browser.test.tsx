import type { RecomposeIpc, RuntimeReachability } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../../shared/testing';

import { installFakeBridge } from '../../../../shared/testing';
import { DetectRuntimeStep } from './detect-runtime-step';

function Step() {
  const [connected, setConnected] = useState(false);

  return connected ? (
    <p>The step stepped aside.</p>
  ) : (
    <DetectRuntimeStep
      onConnected={() => {
        setConnected(true);
      }}
      runtime="ollama"
    />
  );
}

async function renderStep(parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Step />
    </QueryClientProvider>,
  );
}

function lookAnsweringInTurn(...readings: readonly RuntimeReachability[]) {
  let looksTaken = 0;

  return async () => {
    const reading = readings[Math.min(looksTaken, readings.length - 1)];

    looksTaken += 1;

    if (reading === undefined) {
      throw new Error('the scripted look ran out of readings');
    }

    return Promise.resolve({ ok: true as const, value: reading });
  };
}

function lookRefusedAfterOne(first: RuntimeReachability): RecomposeIpc['accounts:detect-runtime'] {
  let looksTaken = 0;

  return async () => {
    looksTaken += 1;

    return looksTaken === 1
      ? Promise.resolve({ ok: true as const, value: first })
      : Promise.resolve({
          ok: false as const,
          error: {
            code: 'storage-failed' as const,
            message: 'recompose could not read the registry.',
          },
        });
  };
}

async function press(name: string) {
  const control = page.getByRole('button', { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

async function storedAccounts() {
  const registry = await window.recompose['accounts:list']();

  return registry.ok ? registry.value.accounts : [];
}

test('picking the runtime looks at once and reports the running server', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();
  await expect.element(screen.getByText('Version 0.5.1')).toBeVisible();
});

test('the look asks no permission, offering no act while it is out', async () => {
  const screen = await renderStep({
    overrides: { 'accounts:detect-runtime': async () => new Promise(() => undefined) },
  });

  await expect.element(screen.getByRole('status')).toHaveTextContent('Checking');
  await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
});

test('a running runtime stands Add as the one settle act', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await expect.element(screen.getByRole('button', { name: 'Add Ollama' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Check again' })).not.toBeInTheDocument();
});

test('silence reads its remedy, standing Add anyway beside the Check again that leads', async () => {
  const screen = await renderStep();

  await expect
    .element(
      screen.getByText("Ollama isn't running at 127.0.0.1:11434. Start it, then check again."),
    )
    .toBeVisible();

  const acts = screen.getByRole('button').all();

  expect(acts.map((act) => act.element().textContent)).toEqual(['Add anyway', 'Check again']);
});

test('a strange answer on the port never reads as the runtime', async () => {
  const screen = await renderStep({ reachability: { verdict: 'unrecognized', status: 404 } });

  await expect
    .element(screen.getByText('Another server answered at 127.0.0.1:11434.'))
    .toBeVisible();
  await expect.element(screen.getByText(/Ollama is running/)).not.toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Check again' })).toBeVisible();
});

test('Check again re-runs the look and reports what it finds now', async () => {
  const screen = await renderStep({
    overrides: {
      'accounts:detect-runtime': lookAnsweringInTurn(
        { verdict: 'unreachable' },
        { verdict: 'answers', version: '0.5.1' },
      ),
    },
  });

  await expect.element(screen.getByText(/isn't running/)).toBeVisible();

  await press('Check again');

  await expect.element(screen.getByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();
});

test('silence stores nothing until the person decides, then Add anyway stores it', async () => {
  const screen = await renderStep();

  await expect.element(screen.getByText(/isn't running/)).toBeVisible();
  expect(await storedAccounts()).toEqual([]);

  await press('Add anyway');

  await expect.element(screen.getByText('The step stepped aside.')).toBeVisible();
  expect(await storedAccounts()).toEqual([
    { id: 'a1', provider: 'ollama', kind: 'local', address: 'http://127.0.0.1:11434' },
  ]);
});

test('adding the running runtime stores its account and hands the sheet back', async () => {
  const screen = await renderStep({ reachability: { verdict: 'answers', version: '0.5.1' } });

  await press('Add Ollama');

  await expect.element(screen.getByText('The step stepped aside.')).toBeVisible();
  expect((await storedAccounts()).map((account) => account.kind)).toEqual(['local']);
});

test('a refused add says why in place rather than closing over it', async () => {
  const screen = await renderStep({
    reachability: { verdict: 'answers', version: '0.5.1' },
    overrides: {
      'accounts:connect-local': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'name-conflict', message: 'Ollama is already connected.' },
        }),
    },
  });

  await press('Add Ollama');

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Ollama is already connected.');
  await expect.element(screen.getByText('The step stepped aside.')).not.toBeInTheDocument();
});

test('a refused re-look reads the refusal rather than the verdict the last look reported', async () => {
  const screen = await renderStep({
    overrides: { 'accounts:detect-runtime': lookRefusedAfterOne({ verdict: 'unreachable' }) },
  });

  await expect.element(screen.getByText(/isn't running/)).toBeVisible();

  await press('Check again');

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('recompose could not read the registry.');
  await expect.element(screen.getByText(/isn't running/)).not.toBeInTheDocument();
});

test('a look the bridge refused reads its reason and still offers both decisions', async () => {
  const screen = await renderStep({
    overrides: {
      'accounts:detect-runtime': async () =>
        Promise.resolve({
          ok: false,
          error: { code: 'storage-failed', message: 'recompose could not read the registry.' },
        }),
    },
  });

  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('recompose could not read the registry.');
  await expect.element(screen.getByRole('button', { name: 'Check again' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Add anyway' })).toBeVisible();
});

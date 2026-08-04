import type { RecomposeIpc, RuntimeReachability } from '@recompose/contracts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { expect } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../../../shared/testing';

import { installFakeBridge } from '../../../shared/testing';
import { DetectRuntimeStep } from '../ui/detect-runtime-step/detect-runtime-step';

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

const retriesOff = { queries: { retry: false }, mutations: { retry: false } };

export async function renderStep(parameters: BridgeParameters = {}) {
  installFakeBridge(parameters);

  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: retriesOff })}>
      <Step />
    </QueryClientProvider>,
  );
}

export function lookAnsweringInTurn(...readings: readonly RuntimeReachability[]) {
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

export function lookAnsweringOnPort(
  answeringPort: number,
  version: string,
): RecomposeIpc['accounts:detect-runtime'] {
  return async ({ port }) =>
    Promise.resolve({
      ok: true as const,
      value: port === answeringPort ? { verdict: 'answers', version } : { verdict: 'unreachable' },
    });
}

export function lookRefusedAfterOne(
  first: RuntimeReachability,
): RecomposeIpc['accounts:detect-runtime'] {
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

export async function press(name: string) {
  const control = page.getByRole('button', { name, exact: true });

  await expect.element(control).toBeVisible();

  control.element().focus();

  await userEvent.keyboard('{Enter}');
}

export async function storedAccounts() {
  const registry = await window.recompose['accounts:list']();

  return registry.ok ? registry.value.accounts : [];
}

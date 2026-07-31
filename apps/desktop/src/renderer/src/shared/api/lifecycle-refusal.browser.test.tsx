import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import type { BridgeParameters } from '../testing';

import { gatewaySeed, installFakeBridge } from '../testing';
import { useStartGateway, useStopGateway } from './engine';
import { useMoveGatewayPort } from './gateways';

const codex = gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 });

const NO_SUCH_GATEWAY =
  'recompose stores no gateway under the slug "codex", so it has nothing to reach.';

function LifecycleProbe() {
  const startGateway = useStartGateway();
  const stopGateway = useStopGateway();
  const moveGatewayPort = useMoveGatewayPort();
  const refusal = startGateway.refusal ?? stopGateway.refusal ?? moveGatewayPort.refusal;

  return (
    <>
      <button
        onClick={() => {
          startGateway.mutate({ slug: 'codex' });
        }}
        type="button"
      >
        Start
      </button>
      <button
        onClick={() => {
          stopGateway.mutate({ slug: 'codex' });
        }}
        type="button"
      >
        Stop
      </button>
      <button
        onClick={() => {
          moveGatewayPort.mutate({ slug: 'codex' });
        }}
        type="button"
      >
        Move
      </button>
      {refusal !== undefined && <p role="alert">{refusal}</p>}
    </>
  );
}

async function openProbe(parameters: BridgeParameters) {
  installFakeBridge(parameters);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <LifecycleProbe />
    </QueryClientProvider>,
  );
}

function refusing(channel: 'engine:start' | 'engine:stop' | 'gateways:move-port') {
  return {
    gateways: [codex],
    overrides: {
      [channel]: async () =>
        Promise.resolve({
          ok: false as const,
          error: { code: 'storage-failed' as const, message: NO_SUCH_GATEWAY },
        }),
    },
  };
}

test('a start the engine refuses says why, rather than leaving the control silent', async () => {
  await openProbe(refusing('engine:start'));

  await userEvent.click(page.getByRole('button', { name: 'Start' }));

  await expect.element(page.getByRole('alert')).toHaveTextContent(NO_SUCH_GATEWAY);
});

test('a stop the engine refuses says why too', async () => {
  await openProbe(refusing('engine:stop'));

  await userEvent.click(page.getByRole('button', { name: 'Stop' }));

  await expect.element(page.getByRole('alert')).toHaveTextContent(NO_SUCH_GATEWAY);
});

test('a move onto a free port that fails says why', async () => {
  await openProbe(refusing('gateways:move-port'));

  await userEvent.click(page.getByRole('button', { name: 'Move' }));

  await expect.element(page.getByRole('alert')).toHaveTextContent(NO_SUCH_GATEWAY);
});

test('a start nothing refused leaves no refusal standing', async () => {
  await openProbe({ gateways: [codex] });

  await userEvent.click(page.getByRole('button', { name: 'Start' }));

  await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
});

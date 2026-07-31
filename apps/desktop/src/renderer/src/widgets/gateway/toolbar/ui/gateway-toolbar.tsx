import type { GatewayEngineState } from '@recompose/contracts';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  engineStatesQueryOptions,
  gatewayStateIn,
  gatewaysQueryOptions,
  useMoveGatewayPort,
  useStartGateway,
  useStopGateway,
} from '../../../../shared/api';
import { CopyButton } from '../../../../shared/ui';
import { FailedStartLine } from './failed-start-line';

type GatewayToolbarProps = {
  /** Which gateway the toolbar acts on, which is always the selected one. */
  slug: string;
};

const stateWord = {
  running: 'Running',
  stopped: 'Stopped',
} as const;

function failedStartIn(state: GatewayEngineState): { port: number } | undefined {
  return state.status === 'stopped' ? state.failure : undefined;
}

type AddressPillProps = {
  /** The origin a person pastes into a client, which the copy control hands over whole. */
  address: string;
  port: number;
  status: GatewayEngineState['status'];
};

/** The address the gateway answers on, filling the strip the way the reference draws it. */
function AddressPill({ address, port, status }: AddressPillProps) {
  return (
    <span className="relative flex h-7.5 min-w-0 flex-1 items-center justify-center gap-2.25 overflow-hidden rounded-control border border-line-subtle bg-surface-raised px-8 font-mono text-note whitespace-nowrap">
      <span>
        <span className="text-ink-secondary">http://</span>
        <span className="text-ink">{`localhost:${String(port)}`}</span>
      </span>
      <span className="text-ink-secondary">·</span>
      <span className="text-ink-secondary">{stateWord[status]}</span>
      <span className="absolute inset-e-1.5 top-1/2 flex -translate-y-1/2">
        <CopyButton label="Copy address" value={address} />
      </span>
    </span>
  );
}

/**
 * The address of the selected gateway, the way to copy it, and the control that runs it.
 *
 * @summary Reach for it in the app shell's toolbar strip. Every control here reaches the one
 * gateway the person selected and never a second one.
 */
export function GatewayToolbar({ slug }: GatewayToolbarProps) {
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);
  const { data: states } = useSuspenseQuery(engineStatesQueryOptions);
  const startGateway = useStartGateway();
  const stopGateway = useStopGateway();
  const moveGatewayPort = useMoveGatewayPort();
  const [attempt, setAttempt] = useState(0);
  const gateway = gateways.find((held) => held.slug === slug);

  if (gateway === undefined) {
    return null;
  }

  const state = gatewayStateIn(states, slug);
  const running = state.status === 'running';
  const address = `http://localhost:${String(gateway.port)}`;
  const failure = failedStartIn(state);

  function start() {
    setAttempt((made) => made + 1);
    startGateway.mutate({ slug });
  }

  function stop() {
    stopGateway.mutate({ slug });
  }

  function moveToFreePort() {
    moveGatewayPort.mutate({ slug });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="app-no-drag flex h-toolbar items-center gap-2.5 px-3.5">
        <AddressPill address={address} port={gateway.port} status={state.status} />
        <button className="push-button" onClick={running ? stop : start} type="button">
          {running ? 'Stop' : 'Start'}
        </button>
      </div>
      {failure !== undefined && (
        <div className="app-no-drag px-4 pb-2">
          <FailedStartLine key={attempt} onMoveToFreePort={moveToFreePort} port={failure.port} />
        </div>
      )}
    </div>
  );
}

import type { GatewayEngineState } from '@recompose/contracts';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';

import type { IconName } from '../../../../shared/ui';

import {
  engineStatesQueryOptions,
  gatewayStateIn,
  gatewaysQueryOptions,
  useMoveGatewayPort,
  useStartGateway,
  useStopGateway,
} from '../../../../shared/api';
import { sidebarHidden, subscribeToSidebarVisibility } from '../../../../shared/lib';
import { CopyButton, Icon, SidebarToggle } from '../../../../shared/ui';
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
  const mark = status === 'running' ? 'bg-running' : 'bg-stopped';

  return (
    <span className="relative flex h-7.5 min-w-0 flex-1 items-center justify-center gap-2.25 overflow-hidden rounded-control border border-line-subtle bg-surface-raised px-8 font-mono text-note whitespace-nowrap">
      <Icon
        className="absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-accent-ink"
        name="network"
      />
      <span className={`size-1.75 shrink-0 rounded-pill ${mark}`} />
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

const GROUP =
  'inline-flex h-7.25 items-center gap-0.5 rounded-control border border-line-subtle bg-surface-raised p-0.5';

const shape = {
  grouped: 'h-5.75 w-7.75 rounded-chip',
  standing: 'h-7.25 w-8.5 rounded-control border border-line-subtle bg-surface-raised',
} as const;

type ToolbarButtonProps = {
  glyph: IconName;
  label: string;
  onPress?: (() => void) | undefined;
  /** The ink the glyph takes, which the run control uses to carry its own state. */
  tone?: string;
  /** The surface it waits for, named for anyone who presses it before its machinery lands. */
  waitsFor?: string;
  where: keyof typeof shape;
};

/**
 * One control of the toolbar, whether it sits alone or inside a button group.
 *
 * @summary Every control in the strip comes from here, so a hover, a focus ring, or a size that
 * changes once changes for all of them.
 */
function ToolbarButton({
  glyph,
  label,
  onPress,
  tone = 'text-ink-secondary',
  waitsFor,
  where,
}: ToolbarButtonProps) {
  return (
    <button
      aria-label={label}
      className={`flex items-center justify-center focus-ring hover:bg-surface-hover ${shape[where]} ${tone}`}
      onClick={onPress}
      title={waitsFor === undefined ? label : `${label}. Waits on ${waitsFor}.`}
      type="button"
    >
      <Icon className="size-4" name={glyph} />
    </button>
  );
}

/** The two panel toggles the reference stands at the trailing edge. */
function PanelGroup() {
  return (
    <span className={GROUP}>
      <ToolbarButton
        glyph="panel-bottom"
        label="Request log"
        waitsFor="request logging"
        where="grouped"
      />
      <ToolbarButton
        glyph="panel-right"
        label="Inspector"
        waitsFor="the inspector"
        where="grouped"
      />
    </span>
  );
}

type ToolbarFooterProps = {
  /** Names the attempt a message belongs to, so a repeated sentence announces itself again. */
  attempt: number;
  failure: { port: number } | undefined;
  onMoveToFreePort: () => void;
  refusal: string | undefined;
};

/**
 * The line under the strip, carrying whichever of the two failures stands.
 *
 * @summary A refused request and a lost port are different failures, and only one of them can be
 * true at a time. A refusal means the engine never answered, so it takes the line rather than a
 * sentence about a port nobody reached.
 */
function ToolbarFooter({ attempt, failure, onMoveToFreePort, refusal }: ToolbarFooterProps) {
  if (refusal !== undefined) {
    return (
      <div className="app-no-drag px-4 pb-2">
        <p className="text-caption text-danger-ink" role="alert">
          {refusal}
        </p>
      </div>
    );
  }

  if (failure === undefined) {
    return null;
  }

  return (
    <div className="app-no-drag px-4 pb-2">
      <FailedStartLine key={attempt} onMoveToFreePort={onMoveToFreePort} port={failure.port} />
    </div>
  );
}

type ToolbarStripProps = {
  address: string;
  /** The gateway the strip acts on, spoken as the toolbar's own name. */
  name: string;
  onRun: () => void;
  port: number;
  running: boolean;
  status: GatewayEngineState['status'];
};

/** The strip itself, holding the run control, the address, and the four the reference draws. */
function ToolbarStrip({ address, name, onRun, port, running, status }: ToolbarStripProps) {
  const away = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <div
      aria-label={name}
      className={`app-no-drag flex h-toolbar items-center gap-2.5 pe-3.5 ${away ? 'ps-window-controls-width' : 'ps-3.5'}`}
      role="toolbar"
    >
      <SidebarToggle />
      <ToolbarButton
        glyph={running ? 'stop' : 'play'}
        label={running ? 'Stop' : 'Start'}
        onPress={onRun}
        tone={running ? 'text-stopped' : 'text-running'}
        where="standing"
      />
      <ToolbarButton glyph="book" label="Docs" waitsFor="the guide" where="standing" />
      <AddressPill address={address} port={port} status={status} />
      <ToolbarButton glyph="tidy" label="Tidy the canvas" waitsFor="the canvas" where="standing" />
      <ToolbarButton
        glyph="json"
        label="View as JSON"
        waitsFor="the config view"
        where="standing"
      />
      <PanelGroup />
    </div>
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
  const refusal = startGateway.refusal ?? stopGateway.refusal ?? moveGatewayPort.refusal;

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
      <ToolbarStrip
        address={address}
        name={gateway.displayName}
        onRun={running ? stop : start}
        port={gateway.port}
        running={running}
        status={state.status}
      />
      <ToolbarFooter
        attempt={attempt}
        failure={failure}
        onMoveToFreePort={moveToFreePort}
        refusal={refusal}
      />
    </div>
  );
}

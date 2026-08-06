import type { GatewayConfig } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import type { SettledDefinition } from '../../lib/model-draft';
import type { ServedModel } from '../../model/served-models';

import {
  accountsQueryOptions,
  engineStatesQueryOptions,
  gatewayStateIn,
} from '../../../../shared/api';
import { subscribeToPanelWidths } from '../../../../shared/lib';
import { CopyButton, Icon, stateMark, stateWord } from '../../../../shared/ui';
import { inspectorWidth } from '../../lib/inspector-width';
import { servedModels, servesTally } from '../../model/served-models';
import { AddModelFlow } from '../add-model-flow/add-model-flow';
import { ServedModelRow } from '../served-model-row/served-model-row';

type GatewayDrawerProps = {
  /** The gateway the drawer speaks for, which is the one the route selected. */
  gateway: GatewayConfig;
  /** The draft standing in the add flow, or nothing while the drawer reads what serves. */
  drafting: SettledDefinition | undefined;
  /** Whether the drawer is on its way off screen, which is what plays its exit. */
  leaving?: boolean;
  /** Receives the ask to start defining a virtual model. */
  onStartDrafting: () => void;
  /** Receives the ask to leave the flow, which a finished save makes too. */
  onLeaveDrafting: () => void;
  /** Receives a draft the flow is handing back as it leaves the screen unfinished. */
  onKeepDrafting: (values: SettledDefinition) => void;
};

function drawerHead(gateway: GatewayConfig): ReactNode {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-4 pb-1">
      <span className="flex size-7.5 shrink-0 items-center justify-center rounded-control bg-accent text-highlight-ink">
        <Icon className="size-4" name="network" />
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-heading text-ink">{gateway.displayName}</h2>
        <p className="truncate font-mono text-mono-value text-accent-ink">{gateway.slug}</p>
      </div>
    </header>
  );
}

function sectionHeading(title: string, tally?: ReactNode): ReactNode {
  return (
    <h3 className="mt-3.5 mb-1.5 flex min-w-0 items-center gap-1.5 px-1 text-caption font-bold text-ink-secondary">
      <span className="shrink-0">{title}</span>
      {tally}
    </h3>
  );
}

function endpointBox(gateway: GatewayConfig, status: 'running' | 'stopped'): ReactNode {
  const baseUrl = `http://localhost:${String(gateway.port)}`;

  return (
    <div className="field-box">
      <div className="flex min-h-sheet-row items-center gap-2 px-3 py-1.5">
        <span className="text-control text-ink">Base URL</span>
        <span className="ms-auto truncate font-mono text-mono-value text-ink">{baseUrl}</span>
        <CopyButton label="Copy base URL" value={baseUrl} />
      </div>
      <div className="flex min-h-sheet-row items-center gap-2 border-t border-line-faint px-3 py-1.5">
        <span className="text-control text-ink">Status</span>
        <span className="ms-auto flex items-center gap-1.5 text-detail text-ink">
          <span aria-hidden className={`size-1.75 shrink-0 rounded-pill ${stateMark[status]}`} />
          {stateWord[status]}
        </span>
      </div>
    </div>
  );
}

function servesBox(served: readonly ServedModel[], onDefine: () => void): ReactNode {
  if (served.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 field-box px-4 py-5 text-center">
        <p className="text-control font-semibold text-ink-secondary">Nothing serves yet</p>
        <p className="text-detail text-ink-secondary">
          Add a virtual model to map a name onto a stored account.
        </p>
        <button className="mt-1 push-button whitespace-nowrap" onClick={onDefine} type="button">
          Add virtual model
        </button>
      </div>
    );
  }

  return (
    <ul className="field-box">
      {served.map((model) => (
        <ServedModelRow key={model.id} served={model} />
      ))}
    </ul>
  );
}

type Overview = {
  gateway: GatewayConfig;
  served: readonly ServedModel[];
  status: 'running' | 'stopped';
  onDefine: () => void;
};

function gatewayOverview({ gateway, served, status, onDefine }: Overview): ReactNode {
  return (
    <>
      {drawerHead(gateway)}
      <div className="flex-1 overflow-y-auto px-3.5 pb-4">
        {sectionHeading('Endpoint')}
        {endpointBox(gateway, status)}
        {sectionHeading(
          'Serves',
          served.length === 0 ? null : (
            <span className="min-w-0 truncate font-medium text-ink-secondary">
              · {servesTally(served.length)}
            </span>
          ),
        )}
        {servesBox(served, onDefine)}
      </div>
    </>
  );
}

/**
 * The inspector for the selected gateway: where it answers, and what it serves.
 *
 * @summary Reach for it beside the stage. The drawer is where a gateway is read and changed until
 * the canvas arrives, so defining a virtual model takes the drawer over rather than opening a sheet
 * on top of it, and a person keeps their place on the gateway they were already looking at.
 */
export function GatewayDrawer({
  gateway,
  drafting,
  leaving = false,
  onStartDrafting,
  onLeaveDrafting,
  onKeepDrafting,
}: GatewayDrawerProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const { data: states } = useSuspenseQuery(engineStatesQueryOptions);
  const width = useSyncExternalStore(subscribeToPanelWidths, inspectorWidth);

  return (
    <aside
      data-panel-control=""
      className={`shrink-0 overflow-hidden border-s border-line-subtle bg-surface-toolbar ${leaving ? 'inspector-panel-leaving' : 'inspector-panel'}`}
      style={{ width }}
    >
      <div className="flex h-full shrink-0 flex-col" style={{ width }}>
        {drafting === undefined ? (
          gatewayOverview({
            gateway,
            served: servedModels(gateway.virtualModels, registry.accounts),
            status: gatewayStateIn(states, gateway.slug).status,
            onDefine: onStartDrafting,
          })
        ) : (
          <AddModelFlow
            gateway={gateway}
            onBack={onLeaveDrafting}
            onKeep={onKeepDrafting}
            opening={drafting}
          />
        )}
      </div>
    </aside>
  );
}

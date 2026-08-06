import type { GatewayConfig } from '@recompose/contracts';
import type { ReactNode } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ServedModel } from '../../model/served-models';

import {
  accountsQueryOptions,
  engineStatesQueryOptions,
  gatewayStateIn,
} from '../../../../shared/api';
import { CopyButton, Icon, stateMark, stateWord } from '../../../../shared/ui';
import { servedModels, servesTally } from '../../model/served-models';
import { AddModelFlow } from '../add-model-flow/add-model-flow';
import { ServedModelRow } from '../served-model-row/served-model-row';

type GatewayDrawerProps = {
  /** The gateway the drawer speaks for, which is the one the route selected. */
  gateway: GatewayConfig;
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

function sectionHeading(title: string, tally: ReactNode, act: ReactNode): ReactNode {
  return (
    <h3 className="mt-3.5 mb-1.5 flex items-center gap-1.5 px-1 text-caption font-bold text-ink-secondary">
      {title}
      {tally}
      {act}
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

function servesBox(served: readonly ServedModel[]): ReactNode {
  if (served.length === 0) {
    return (
      <div className="field-box px-4 py-5 text-center">
        <p className="text-control font-semibold text-ink-secondary">Nothing serves yet</p>
        <p className="mt-0.5 text-detail text-ink-secondary">
          Add a virtual model to map a name onto a stored account.
        </p>
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
        {sectionHeading('Endpoint', null, null)}
        {endpointBox(gateway, status)}
        {sectionHeading(
          'Serves',
          <span className="font-medium text-ink-secondary">· {servesTally(served.length)}</span>,
          <button
            className="ms-auto flex items-center gap-1 rounded-control px-1.5 py-0.5 text-caption font-semibold text-accent-ink focus-ring row-hover"
            onClick={onDefine}
            type="button"
          >
            <Icon className="size-3" name="plus" />
            Add virtual model
          </button>,
        )}
        {servesBox(served)}
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
export function GatewayDrawer({ gateway }: GatewayDrawerProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const { data: states } = useSuspenseQuery(engineStatesQueryOptions);
  const [defining, setDefining] = useState(false);

  return (
    <aside className="flex w-76 shrink-0 flex-col border-s border-line-subtle bg-surface-toolbar">
      {defining ? (
        <AddModelFlow
          gateway={gateway}
          onBack={() => {
            setDefining(false);
          }}
        />
      ) : (
        gatewayOverview({
          gateway,
          served: servedModels(gateway.virtualModels, registry.accounts),
          status: gatewayStateIn(states, gateway.slug).status,
          onDefine: () => {
            setDefining(true);
          },
        })
      )}
    </aside>
  );
}

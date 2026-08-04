import { useState } from 'react';

import type { AccountKind } from '../../../../entities/account';
import type { CatalogEntry, ConnectionWay } from '../../model/provider-catalog';

import { Sheet } from '../../../../shared/ui';
import { CatalogList } from '../catalog-list/catalog-list';
import { ProviderConnectWay } from '../provider-connect-way/provider-connect-way';

export type CatalogFlowProps = {
  /** The kind the screen behind holds, which is the only kind the catalog offers. */
  kind: AccountKind;
  /** Whether the catalog stands over the screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal and a finished connect. */
  onOpenChange: (open: boolean) => void;
};

type ConnectStep = { entry: CatalogEntry; way: ConnectionWay };

function connectStepFor(
  picked: CatalogEntry | undefined,
  kind: AccountKind,
): ConnectStep | undefined {
  return picked === undefined ? undefined : { entry: picked, way: kind };
}

const descriptions: Record<AccountKind, string> = {
  subscription: 'Sign in with a plan you already pay for.',
  'api-key': "Paste a key for one provider's endpoint.",
  aggregator: 'One key, many models, routed through a hosted catalog.',
  local: 'Servers this machine already runs.',
};

/**
 * The two steps of the catalog: the grid of one kind, then the picked provider's connect.
 *
 * @summary The flow forgets its pick at the moment it reopens rather than while it closes, so the
 * next open always starts on the grid and a closing sheet never flashes a reset step mid-fade.
 */
function useFreshGridOnReopen(open: boolean, forgetThePick: () => void): void {
  const [stoodOpen, setStoodOpen] = useState(open);

  if (open !== stoodOpen) {
    setStoodOpen(open);

    if (open) {
      forgetThePick();
    }
  }
}

export function CatalogFlow({ kind, open, onOpenChange }: CatalogFlowProps) {
  const [picked, setPicked] = useState<CatalogEntry | undefined>(undefined);
  const [arrived, setArrived] = useState<'opening' | 'back'>('opening');

  useFreshGridOnReopen(open, () => {
    setPicked(undefined);
    setArrived('opening');
  });

  const back = () => {
    setPicked(undefined);
    setArrived('back');
  };

  const connecting = connectStepFor(picked, kind);

  return (
    <Sheet
      description={descriptions[kind]}
      footer={
        <button
          className="push-button"
          onClick={() => {
            onOpenChange(false);
          }}
          type="button"
        >
          Cancel
        </button>
      }
      onBack={picked === undefined ? undefined : back}
      onOpenChange={onOpenChange}
      open={open}
      title="Add provider"
      wide={connecting === undefined}
    >
      {connecting === undefined ? (
        <div className={arrived === 'back' ? 'step-enter-back' : ''}>
          <CatalogList kind={kind} onPick={setPicked} />
        </div>
      ) : (
        <div className="step-enter-forward">
          <ProviderConnectWay
            entry={connecting.entry}
            onConnected={() => {
              onOpenChange(false);
            }}
            way={connecting.way}
          />
        </div>
      )}
    </Sheet>
  );
}

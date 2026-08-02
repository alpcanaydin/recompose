import { useState } from 'react';

import type { AccountKind } from '../../../entities/account';
import type { CatalogEntry } from '../model/provider-catalog';

import { Sheet } from '../../../shared/ui';
import { CatalogList } from './catalog-list';
import { ProviderConnectWay } from './provider-connect-way';

export type CatalogFlowProps = {
  /** The kind the screen behind holds, which is the only kind the catalog offers. */
  kind: AccountKind;
  /** Whether the catalog stands over the screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal and a finished connect. */
  onOpenChange: (open: boolean) => void;
};

const descriptions: Record<AccountKind, string> = {
  subscription: 'Sign in with a plan you already pay for.',
  'api-key': "Paste a key for one provider's endpoint.",
  aggregator: 'One key that reaches many providers.',
  local: 'Servers on this machine, once recompose can run one.',
};

/**
 * The two steps of the catalog: the grid of one kind, then the picked provider's connect.
 *
 * @summary The caller keys this to the open state, so a closing sheet keeps whichever step it
 * was showing until it has left the screen, and the next open always starts on the grid.
 */
export function CatalogFlow({ kind, open, onOpenChange }: CatalogFlowProps) {
  const [picked, setPicked] = useState<CatalogEntry | undefined>(undefined);
  const [arrived, setArrived] = useState<'opening' | 'back'>('opening');

  const back = () => {
    setPicked(undefined);
    setArrived('back');
  };

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
      wide
    >
      {picked === undefined || kind === 'local' ? (
        <div className={arrived === 'back' ? 'step-enter-back' : ''}>
          <CatalogList kind={kind} onPick={setPicked} />
        </div>
      ) : (
        <div className="step-enter-forward">
          <ProviderConnectWay
            entry={picked}
            onConnected={() => {
              onOpenChange(false);
            }}
            way={kind}
          />
        </div>
      )}
    </Sheet>
  );
}

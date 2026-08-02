import { useState } from 'react';

import type { CatalogEntry, ConnectionWay } from '../model/provider-catalog';

import { Drawer } from '../../../shared/ui';
import { CatalogList } from './catalog-list';
import { ProviderConnectFork } from './provider-connect-fork';

type ProviderCatalogDrawerProps = {
  /** Whether the catalog stands beside the screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal and a finished connect. */
  onOpenChange: (open: boolean) => void;
};

/**
 * The catalog of providers, opening beside the screen so what it adds to stays in view.
 *
 * @summary Reach for it from the Add provider control. The list narrows by search and by chip,
 * and picking a provider trades the list for that provider's ways rather than opening a second
 * surface on top of this one. A finished connect closes the catalog, because the account it made
 * is on the screen behind, and a closed catalog forgets what narrowed it, so the next open stands
 * on the whole list.
 */
export function ProviderCatalogDrawer({ open, onOpenChange }: ProviderCatalogDrawerProps) {
  const [search, setSearch] = useState('');
  const [way, setWay] = useState<ConnectionWay | undefined>(undefined);
  const [picked, setPicked] = useState<CatalogEntry | undefined>(undefined);

  const settle = (next: boolean) => {
    setPicked(undefined);
    setSearch('');
    setWay(undefined);
    onOpenChange(next);
  };

  return (
    <Drawer onOpenChange={settle} open={open} title="Add provider">
      {picked === undefined ? (
        <CatalogList
          onPick={setPicked}
          onSearchChange={setSearch}
          onWayChange={setWay}
          search={search}
          way={way}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          <button
            className="self-start text-control text-accent-ink focus-ring"
            onClick={() => {
              setPicked(undefined);
            }}
            type="button"
          >
            All providers
          </button>
          <ProviderConnectFork
            entry={picked}
            onConnected={() => {
              settle(false);
            }}
          />
        </div>
      )}
    </Drawer>
  );
}

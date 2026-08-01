import { useState } from 'react';

import type { CatalogEntry, ConnectionWay } from '../model/provider-catalog';

import { accountKindTitle } from '../../../entities/account';
import { BrandMark, Chip, Drawer, TextField } from '../../../shared/ui';
import { catalogEntries, catalogGroups, narrowedCatalog } from '../model/provider-catalog';
import { ProviderConnectFork } from './provider-connect-fork';

type ProviderCatalogDrawerProps = {
  /** Whether the catalog stands beside the screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal and a finished connect. */
  onOpenChange: (open: boolean) => void;
};

const chipWays: readonly ConnectionWay[] = ['subscription', 'api-key', 'aggregator'];

type CatalogListProps = {
  search: string;
  onSearchChange: (search: string) => void;
  way: ConnectionWay | undefined;
  onWayChange: (way: ConnectionWay | undefined) => void;
  onPick: (entry: CatalogEntry) => void;
};

function CatalogList({ search, onSearchChange, way, onWayChange, onPick }: CatalogListProps) {
  const groups = catalogGroups(narrowedCatalog(catalogEntries, { search, way }), way);

  return (
    <div className="flex flex-col gap-3.5">
      <TextField label="Search providers" onChangeValue={onSearchChange} value={search} />
      <div className="flex flex-wrap gap-1.5">
        {chipWays.map((offered) => (
          <Chip
            key={offered}
            onSelectedChange={(selected) => {
              onWayChange(selected ? offered : undefined);
            }}
            selected={way === offered}
          >
            {accountKindTitle(offered)}
          </Chip>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="text-body text-ink-secondary">No provider matches that search.</p>
      ) : (
        groups.map((group) => (
          <section className="flex flex-col gap-1" key={group.way}>
            <h3 className="text-caption text-ink-secondary">{group.title}</h3>
            {group.entries.map((entry) => (
              <button
                className="flex items-center gap-2.5 rounded-control p-2 text-body text-ink focus-ring row-hover"
                key={entry.id}
                onClick={() => {
                  onPick(entry);
                }}
                type="button"
              >
                <BrandMark name={entry.id} />
                {entry.name}
              </button>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

/**
 * The catalog of providers, opening beside the screen so what it adds to stays in view.
 *
 * @summary Reach for it from the Add provider control. The list narrows by search and by chip,
 * and picking a provider trades the list for that provider's ways rather than opening a second
 * surface on top of this one. A finished connect closes the catalog, because the account it made
 * is on the screen behind.
 */
export function ProviderCatalogDrawer({ open, onOpenChange }: ProviderCatalogDrawerProps) {
  const [search, setSearch] = useState('');
  const [way, setWay] = useState<ConnectionWay | undefined>(undefined);
  const [picked, setPicked] = useState<CatalogEntry | undefined>(undefined);

  const settle = (next: boolean) => {
    setPicked(undefined);
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

import type { ReactNode } from 'react';

import type { CatalogEntry, CatalogGroup, ConnectionWay } from '../model/provider-catalog';

import { accountKindTitle } from '../../../entities/account';
import { BrandMark, Chip, TextField } from '../../../shared/ui';
import { catalogEntries, catalogGroups, narrowedCatalog } from '../model/provider-catalog';

const chipWays: readonly ConnectionWay[] = ['subscription', 'api-key', 'aggregator'];

type CatalogListProps = {
  search: string;
  onSearchChange: (search: string) => void;
  way: ConnectionWay | undefined;
  onWayChange: (way: ConnectionWay | undefined) => void;
  onPick: (entry: CatalogEntry) => void;
};

function groupedRows(
  groups: readonly CatalogGroup[],
  onPick: (entry: CatalogEntry) => void,
): ReactNode {
  if (groups.length === 0) {
    return <p className="text-body text-ink-secondary">No provider matches that search.</p>;
  }

  return groups.map((group) => (
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
  ));
}

/** The searchable, chip-narrowed list of every provider the catalog offers. */
export function CatalogList({
  search,
  onSearchChange,
  way,
  onWayChange,
  onPick,
}: CatalogListProps) {
  const groups = catalogGroups(narrowedCatalog(catalogEntries, { search, way }), way);

  return (
    <div className="flex flex-col gap-3.5">
      <TextField
        label="Search providers"
        onChangeValue={onSearchChange}
        placeholder="Search providers"
        value={search}
      />
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
      {groupedRows(groups, onPick)}
    </div>
  );
}

import type { ReactNode } from 'react';

import type { AccountKind } from '../../../entities/account';
import type { AwaitedProvider, CatalogEntry, ConnectionWay } from '../model/provider-catalog';

import { Badge, BrandMark, Icon } from '../../../shared/ui';
import { awaitedFor, catalogEntries, offerFor, offeredUnder } from '../model/provider-catalog';

type CatalogListProps = {
  /** The kind the screen behind holds, which is the only kind the list offers. */
  kind: AccountKind;
  onPick: (entry: CatalogEntry) => void;
};

function cardBody(lead: ReactNode, title: string, benefit: string): ReactNode {
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-line-subtle bg-surface-raised">
        {lead}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-card-title text-ink">{title}</span>
        <span className="truncate text-detail text-ink-secondary">{benefit}</span>
      </span>
    </>
  );
}

function connectableCards(
  kind: ConnectionWay,
  onPick: (entry: CatalogEntry) => void,
): readonly ReactNode[] {
  return offeredUnder(catalogEntries, kind).map((entry) => {
    const offer = offerFor(entry, kind);

    if (offer === undefined) {
      return null;
    }

    return (
      <button
        className="flex items-center gap-2.5 rounded-card border border-line-subtle bg-surface-card p-3 text-start focus-ring row-hover"
        key={entry.id}
        onClick={() => {
          onPick(entry);
        }}
        type="button"
      >
        {cardBody(<BrandMark name={entry.id} />, offer.title, offer.benefit)}
      </button>
    );
  });
}

function awaitedCards(awaited: readonly AwaitedProvider[]): readonly ReactNode[] {
  return awaited.map((provider) => (
    <button
      aria-disabled
      className="relative flex items-center gap-2.5 rounded-card border border-line-subtle bg-surface-card p-3 text-start opacity-60 focus-ring"
      key={provider.name}
      type="button"
    >
      {cardBody(
        <Icon className="size-4.5 text-ink-secondary" name={provider.glyph} />,
        provider.name,
        provider.benefit,
      )}
      <span className="absolute inset-e-2 top-2">
        <Badge>Soon</Badge>
      </span>
    </button>
  ));
}

/**
 * The providers the screen's kind can connect to, as cards, with the ones that follow later.
 *
 * @summary Reach for it from the catalog. The grid holds one kind because the screen that opened
 * it holds one kind, and a card the release cannot connect yet stands disabled rather than
 * hidden, so the catalog says what it grows toward.
 */
export function CatalogList({ kind, onPick }: CatalogListProps) {
  const cards =
    kind === 'local'
      ? awaitedCards(awaitedFor(kind))
      : [...connectableCards(kind, onPick), ...awaitedCards(awaitedFor(kind))];

  return <div className="grid grid-cols-2 gap-2">{cards}</div>;
}

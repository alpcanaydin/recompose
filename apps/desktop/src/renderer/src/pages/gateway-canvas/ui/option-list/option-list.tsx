import type { ReactElement } from 'react';

import { useState } from 'react';

import type { BrandMarkName } from '../../../../shared/ui';

import { BrandMark, Icon } from '../../../../shared/ui';

export type OptionRow = {
  /** The value picking this option settles on. */
  id: string;
  /** What the option reads as, which is what a person searches by name. */
  name: string;
  /** A quieter fact under the name, where one tells two options apart. */
  detail?: string | undefined;
  /** The vendor mark the option leads with, where recompose draws one. */
  mark?: BrandMarkName | undefined;
};

export type OptionGroup = {
  /** What the options beneath are gathered as, or nothing where one flat list needs no heading. */
  heading?: string | undefined;
  options: readonly OptionRow[];
};

type OptionListProps = {
  /** The options on offer, under the headings they read beneath. */
  groups: readonly OptionGroup[];
  /** The option settled on, which reads as picked. */
  picked: string | undefined;
  /** Receives the id of the option the person picked. */
  onPick: (id: string) => void;
  /** Accessible name of the search field, naming what a person is searching. */
  searchLabel: string;
  /** Sentence standing where the search matched nothing at all. */
  nothingMatched: string;
};

const SEARCH_APPEARS_ABOVE = 6;

function matching(groups: readonly OptionGroup[], typed: string): readonly OptionGroup[] {
  const sought = typed.trim().toLowerCase();

  if (sought === '') {
    return groups;
  }

  const narrowed: OptionGroup[] = [];

  for (const group of groups) {
    const options = group.options.filter((option) =>
      `${option.name} ${option.id} ${option.detail ?? ''}`.toLowerCase().includes(sought),
    );

    if (options.length > 0) {
      narrowed.push({ ...group, options });
    }
  }

  return narrowed;
}

function optionRow(option: OptionRow, picked: boolean, onPick: (id: string) => void): ReactElement {
  return (
    <li key={option.id}>
      <button
        aria-pressed={picked}
        className={`flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-start text-control focus-ring row-hover ${picked ? 'bg-accent/10' : ''}`}
        onClick={() => {
          onPick(option.id);
        }}
        type="button"
      >
        {option.mark === undefined ? (
          <Icon className="size-3.5 shrink-0 text-ink-tertiary" name="spark" />
        ) : (
          <BrandMark className="size-4.5" name={option.mark} />
        )}
        <span className="truncate text-ink">{option.name}</span>
        {option.detail === undefined ? null : (
          <span className="truncate font-mono text-mono-value text-ink-secondary">
            {option.detail}
          </span>
        )}
        {picked ? <Icon className="ms-auto size-4 shrink-0 text-accent-ink" name="check" /> : null}
      </button>
    </li>
  );
}

function gatheredOptions(
  group: OptionGroup,
  picked: string | undefined,
  onPick: (id: string) => void,
): ReactElement {
  return (
    <div key={group.heading ?? 'ungathered'}>
      {group.heading === undefined ? null : (
        <p className="px-2 pt-1.5 pb-0.5 text-footnote font-bold tracking-wider text-ink-secondary uppercase">
          {group.heading}
        </p>
      )}
      <ul>{group.options.map((option) => optionRow(option, option.id === picked, onPick))}</ul>
    </div>
  );
}

/**
 * A list that takes one pick, gathered under headings and searchable once it grows.
 *
 * @summary Reach for it wherever a field holds a value nobody types: a stored account, a model a
 * provider serves. The search appears only once the list outgrows a glance, so a short list reads
 * whole and a long one narrows, and a search matching nothing says so rather than emptying itself.
 * A query narrows only while its field is on screen, so a short list that replaces a long one always
 * reads whole rather than staying filtered by words a person can no longer see or clear.
 */
export function OptionList({
  groups,
  picked,
  onPick,
  searchLabel,
  nothingMatched,
}: OptionListProps) {
  const [typed, setTyped] = useState('');

  const offered = groups.reduce((count, group) => count + group.options.length, 0);
  const searchable = offered > SEARCH_APPEARS_ABOVE;
  const shown = searchable ? matching(groups, typed) : groups;

  return (
    <div className="flex flex-col gap-1">
      {searchable ? (
        <input
          aria-label={searchLabel}
          className="field-control w-full focus-ring placeholder:text-ink-tertiary"
          onInput={(event) => {
            setTyped(event.currentTarget.value);
          }}
          placeholder={searchLabel}
          type="search"
          value={typed}
        />
      ) : null}
      {shown.map((group) => gatheredOptions(group, picked, onPick))}
      {shown.length === 0 ? (
        <p className="px-2 py-1.5 text-detail text-ink-secondary">{nothingMatched}</p>
      ) : null}
    </div>
  );
}

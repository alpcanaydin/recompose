import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import type { ConnectionWay } from '../model/provider-catalog';

import { CatalogList } from './catalog-list';

function StandingCatalog({ search: opening = '' }: { search?: string }) {
  const [search, setSearch] = useState(opening);
  const [way, setWay] = useState<ConnectionWay | undefined>(undefined);

  return (
    <CatalogList
      onPick={() => undefined}
      onSearchChange={setSearch}
      onWayChange={setWay}
      search={search}
      way={way}
    />
  );
}

const meta = preview.meta({
  component: CatalogList,
  args: {
    search: '',
    onSearchChange: () => undefined,
    way: undefined,
    onWayChange: () => undefined,
    onPick: () => undefined,
  },
  render: () => <StandingCatalog />,
  decorators: [
    (Story) => (
      <div className="w-drawer p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The whole catalog, narrowable by the search field and by the chips under it.
 *
 * @summary The reading asks for the field, the three chips, and at least one provider row,
 * because the list is the only way into every kind of account and has to offer all of them.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox', { name: 'Search providers' })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Subscriptions' })).toBeVisible();
    await expect((await canvas.findAllByRole('button')).length).toBeGreaterThan(4);
  },
});

/**
 * A search no provider answers to, which says so rather than standing empty.
 *
 * @summary A silent empty list reads as a broken one, so the absence carries its own sentence.
 */
export const NothingMatches = meta.story({
  render: () => <StandingCatalog search="zzzz" />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/No provider matches/)).toBeVisible();
  },
});

/** The same list in the dark scheme, where the rows have to keep their hover floor. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

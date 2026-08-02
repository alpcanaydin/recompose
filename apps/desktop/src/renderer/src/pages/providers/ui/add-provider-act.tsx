import { useState } from 'react';

import type { AccountKind } from '../../../entities/account';

import { ToolbarButton } from '../../../shared/ui';
import { ProviderCatalogSheet } from './provider-catalog-sheet';

type AddProviderActProps = {
  /** The kind the screen behind holds, which locks the catalog to that kind. */
  kind: AccountKind;
};

/**
 * The one way into the catalog, standing in the window strip over every providers screen.
 *
 * @summary The shell mounts it at the trailing edge of the strip, where macOS keeps a window's
 * own acts, so the screens below stay readings with nothing to press. It owns the catalog it
 * opens, because the act and its destination travel together wherever the strip puts them.
 */
export function AddProviderAct({ kind }: AddProviderActProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <>
      <ToolbarButton
        glyph="plus"
        label="Add provider"
        onPress={() => {
          setCatalogOpen(true);
        }}
        where="standing"
      />
      <ProviderCatalogSheet kind={kind} onOpenChange={setCatalogOpen} open={catalogOpen} />
    </>
  );
}

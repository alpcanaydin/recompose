import { useState } from 'react';

import type { AccountKind } from '../../../../entities/account';

import { Icon } from '../../../../shared/ui';
import { ProviderCatalogSheet } from '../provider-catalog-sheet/provider-catalog-sheet';

type AddProviderActProps = {
  /** The kind the screen behind holds, which locks the catalog to that kind. */
  kind: AccountKind;
};

/**
 * The one way into the catalog, standing in the window strip over every providers screen.
 *
 * @summary The shell mounts it at the trailing edge of the strip, where macOS keeps a window's
 * own acts, so the screens below stay readings with nothing to press. It says its name beside
 * the plus rather than standing as a glyph alone, because it is the screen's primary act and a
 * first visit has no hover to explain a bare symbol. It owns the catalog it opens, because the
 * act and its destination travel together wherever the strip puts them.
 */
export function AddProviderAct({ kind }: AddProviderActProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <>
      <button
        className="push-button-primary focus-ring push-button-window-corners"
        onClick={() => {
          setCatalogOpen(true);
        }}
        type="button"
      >
        <Icon className="size-3.5" name="plus" />
        Add provider
      </button>
      <ProviderCatalogSheet kind={kind} onOpenChange={setCatalogOpen} open={catalogOpen} />
    </>
  );
}

import type { CatalogFlowProps } from '../catalog-flow/catalog-flow';

import { CatalogFlow } from '../catalog-flow/catalog-flow';

type ProviderCatalogSheetProps = CatalogFlowProps;

/**
 * The catalog of providers, opening over the screen that asked for it.
 *
 * @summary Reach for it from the Add provider control. The flow resets itself on the next open
 * rather than remounting, because a remount would tear the dialog out of the tree before its
 * leaving transition could run.
 */
export function ProviderCatalogSheet({ kind, open, onOpenChange }: ProviderCatalogSheetProps) {
  return <CatalogFlow kind={kind} onOpenChange={onOpenChange} open={open} />;
}

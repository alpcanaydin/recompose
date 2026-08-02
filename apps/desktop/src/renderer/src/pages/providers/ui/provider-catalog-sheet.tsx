import type { CatalogFlowProps } from './catalog-flow';

import { CatalogFlow } from './catalog-flow';

type ProviderCatalogSheetProps = CatalogFlowProps;

/**
 * The catalog of providers, opening over the screen that asked for it.
 *
 * @summary Reach for it from the Add provider control. The flow is keyed to the open state, so a
 * dismissal keeps the step it was on while the sheet leaves, and the next open forgets the pick
 * and stands on the whole grid again.
 */
export function ProviderCatalogSheet({ kind, open, onOpenChange }: ProviderCatalogSheetProps) {
  return <CatalogFlow key={String(open)} kind={kind} onOpenChange={onOpenChange} open={open} />;
}

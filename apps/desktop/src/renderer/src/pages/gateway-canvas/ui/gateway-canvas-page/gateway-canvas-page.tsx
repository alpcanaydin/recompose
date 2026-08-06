import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import type { SettledDefinition } from '../../lib/model-draft';

import { gatewaysQueryOptions } from '../../../../shared/api';
import {
  inspectorOpen,
  setPanelWidth,
  subscribeToInspectorVisibility,
  subscribeToPanelWidths,
  toggleInspector,
} from '../../../../shared/lib';
import { panelBounds, PanelSeparator } from '../../../../shared/ui';
import { inspectorWidth } from '../../lib/inspector-width';
import { draftKept, emptyDefinition } from '../../lib/model-draft';
import { useInspectorReveal } from '../../lib/use-inspector-reveal';
import { GatewayDrawer } from '../gateway-drawer/gateway-drawer';
import { GatewayStage } from '../gateway-stage/gateway-stage';

/**
 * The selected gateway: the stage it will be composed on, and the inspector that changes it.
 *
 * @summary Reach for it from the gateway route. Selecting the gateway node opens its inspector and
 * letting the node go closes it, which hands the stage its full width, so the drawer is a thing a
 * person opens rather than a wall the screen always carries. A draft in flight outlives that close:
 * it is held here rather than inside the drawer, so shutting the inspector mid-definition puts the
 * work down instead of throwing it away. A slug no stored gateway holds lands on the same not-found
 * state a mistyped address does, because a gateway that was deleted and one that never existed are
 * the same fact to the person reading, and a blank surface says neither.
 */
export function GatewayCanvasPage({ slug }: { slug: string }) {
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);
  const selected = useSyncExternalStore(subscribeToInspectorVisibility, inspectorOpen);
  const width = useSyncExternalStore(subscribeToPanelWidths, inspectorWidth);
  const inspector = useInspectorReveal(selected);
  const [drafting, setDrafting] = useState<SettledDefinition | undefined>(undefined);

  const keepDrafting = useCallback((values: SettledDefinition) => {
    setDrafting((held) => draftKept(held, values));
  }, []);

  const gateway = gateways.find((held) => held.slug === slug);

  if (gateway === undefined) {
    throw notFound();
  }

  return (
    <div className="flex h-full min-h-0">
      <GatewayStage gateway={gateway} onToggleSelected={toggleInspector} selected={selected} />
      {inspector.rendered ? (
        <PanelSeparator
          bounds={panelBounds.inspector}
          label="Inspector width"
          onCollapse={toggleInspector}
          onResize={(asked) => {
            setPanelWidth('inspector', asked);
          }}
          side="leading"
          width={width}
        />
      ) : null}
      {inspector.rendered ? (
        <GatewayDrawer
          drafting={drafting}
          gateway={gateway}
          leaving={inspector.leaving}
          onKeepDrafting={keepDrafting}
          onLeaveDrafting={() => {
            setDrafting(undefined);
          }}
          onStartDrafting={() => {
            setDrafting(emptyDefinition());
          }}
        />
      ) : null}
    </div>
  );
}

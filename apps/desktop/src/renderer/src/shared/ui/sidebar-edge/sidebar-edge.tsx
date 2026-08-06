import { useSyncExternalStore } from 'react';

import {
  hideSidebar,
  keepPanelWidth,
  panelBounds,
  panelWidth,
  setPanelWidth,
  showSidebar,
  sidebarHidden,
  subscribeToPanelWidths,
  subscribeToSidebarVisibility,
} from '../../lib';
import { PanelSeparator } from '../panel-separator/panel-separator';

function sidebarWidth(): number {
  return panelWidth('sidebar');
}

/**
 * The sidebar's trailing edge, which a person drags to size the sidebar or to put it away.
 *
 * @summary The edge travels with the sidebar, so dragging it inward narrows the sidebar and dragging
 * well past its narrowest width puts it away. Once the sidebar has gone the edge waits at the
 * window's leading edge for the drag that brings it back, so the gesture that put it away is the one
 * that returns it and nobody has to hunt for another control. The width it settles on outlives the
 * collapse, so the sidebar comes back at the width its owner chose rather than the one it shipped
 * with.
 */
export function SidebarEdge() {
  const width = useSyncExternalStore(subscribeToPanelWidths, sidebarWidth);
  const away = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <PanelSeparator
      bounds={panelBounds.sidebar}
      label="Sidebar width"
      onCollapse={hideSidebar}
      onResize={(asked) => {
        setPanelWidth('sidebar', asked);
      }}
      onRestore={showSidebar}
      onSettled={() => {
        keepPanelWidth('sidebar');
      }}
      panelEdge="trailing"
      shut={away}
      width={width}
    />
  );
}

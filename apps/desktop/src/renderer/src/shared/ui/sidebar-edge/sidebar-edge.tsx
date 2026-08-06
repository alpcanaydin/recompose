import { useSyncExternalStore } from 'react';

import { setPanelWidth, subscribeToPanelWidths } from '../../lib/panel-width';
import { hideSidebar } from '../../lib/sidebar-visibility';
import { panelBounds } from '../panel-separator/panel-resize';
import { PanelSeparator } from '../panel-separator/panel-separator';
import { sidebarWidth } from './sidebar-width';

/**
 * The sidebar's trailing edge, which a person drags to size the sidebar or to put it away.
 *
 * @summary The edge travels with the sidebar, so dragging it inward narrows the sidebar and
 * dragging well past its narrowest width puts it away, which is the gesture this edge already
 * carried. The width it settles on outlives the collapse, so bringing the sidebar back returns it
 * to the width its owner chose rather than to the one it shipped with.
 */
export function SidebarEdge() {
  const width = useSyncExternalStore(subscribeToPanelWidths, sidebarWidth);

  return (
    <PanelSeparator
      bounds={panelBounds.sidebar}
      label="Sidebar width"
      onCollapse={hideSidebar}
      onResize={(asked) => {
        setPanelWidth('sidebar', asked);
      }}
      side="trailing"
      width={width}
    />
  );
}

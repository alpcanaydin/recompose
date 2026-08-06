import { panelWidth } from '../../lib/panel-width';

const SIDEBAR_STANDING_WIDTH = 240;

/** How wide the sidebar stands, which is the last width a person dragged it to. */
export function sidebarWidth(): number {
  return panelWidth('sidebar', SIDEBAR_STANDING_WIDTH);
}

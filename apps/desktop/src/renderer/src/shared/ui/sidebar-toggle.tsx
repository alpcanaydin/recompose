import { useSyncExternalStore } from 'react';

import {
  hideSidebar,
  showSidebar,
  sidebarHidden,
  subscribeToSidebarVisibility,
} from '../lib/sidebar-visibility';
import { Icon } from './icon';

/**
 * The control that puts the sidebar away and brings it back.
 *
 * @summary Reach for it at the leading edge of the toolbar strip, which every surface draws
 * whether or not it holds a gateway. That is what keeps a person who put the sidebar away on a
 * surface carrying no gateway from having nothing to press to bring it back.
 */
export function SidebarToggle() {
  const hidden = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <button
      aria-expanded={!hidden}
      aria-label="Sidebar"
      className="flex h-7.25 w-8.5 items-center justify-center rounded-control border border-line-subtle bg-surface-raised text-ink-secondary focus-ring hover:bg-surface-hover"
      onClick={hidden ? showSidebar : hideSidebar}
      type="button"
    >
      <Icon className="size-4" name="panel-left" />
    </button>
  );
}

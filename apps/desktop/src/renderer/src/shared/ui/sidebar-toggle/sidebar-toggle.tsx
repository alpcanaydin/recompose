import { useSyncExternalStore } from 'react';

import {
  hideSidebar,
  showSidebar,
  sidebarHidden,
  subscribeToSidebarVisibility,
} from '../../lib/sidebar-visibility';
import { Icon } from '../icon/icon';

const shape = {
  chrome: 'h-6 w-7 rounded-control',
  standing: 'h-7.25 w-8.5 rounded-control border border-line-subtle bg-surface-raised',
} as const;

type SidebarToggleProps = {
  /**
   * Which row the control stands in. `chrome` is the sidebar's own band beside the window
   * controls, where a raised button reads as a stray member of the toolbar across the divider.
   * `standing` is that toolbar, where it matches the controls it sits among.
   */
  where: keyof typeof shape;
};

/**
 * The control that puts the sidebar away and brings it back.
 *
 * @summary The standing sidebar carries it in its own band, and the toolbar carries it only once
 * the sidebar has gone. That is what keeps a person who put the sidebar away on a surface carrying
 * no gateway from having nothing to press to bring it back.
 */
export function SidebarToggle({ where }: SidebarToggleProps) {
  const hidden = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <button
      aria-expanded={!hidden}
      aria-label="Sidebar"
      className={`flex items-center justify-center text-ink-secondary focus-ring hover:bg-surface-hover active:bg-surface-pressed ${shape[where]}`}
      onClick={hidden ? showSidebar : hideSidebar}
      type="button"
    >
      <Icon className="size-4" name="panel-left" />
    </button>
  );
}

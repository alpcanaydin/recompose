import type { KeyboardEvent, PointerEvent } from 'react';

import { useSyncExternalStore } from 'react';

import { sidebarGestureFrom } from '../lib/sidebar-gesture';
import {
  hideSidebar,
  showSidebar,
  sidebarHidden,
  subscribeToSidebarVisibility,
} from '../lib/sidebar-visibility';

const SIDEBAR_WIDTH = 240;

const asked = {
  hidden: hideSidebar,
  shown: showSidebar,
};

function watchTheDrag(from: number): void {
  const onMove = (moved: globalThis.PointerEvent): void => {
    const gesture = sidebarGestureFrom(moved.clientX - from);

    if (gesture === 'unchanged') {
      return;
    }

    stopWatching();
    asked[gesture]();
  };

  function stopWatching(): void {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stopWatching);
    window.removeEventListener('pointercancel', stopWatching);
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stopWatching);
  window.addEventListener('pointercancel', stopWatching);
}

function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key === 'ArrowLeft') {
    hideSidebar();
  }

  if (event.key === 'ArrowRight') {
    showSidebar();
  }
}

/**
 * The sidebar's trailing edge, which a person drags to put the sidebar away or bring it back.
 *
 * @summary Dragging towards the sidebar puts it away and dragging out from it brings it back,
 * each once the pointer has gone far enough to mean it. The edge travels with the sidebar,
 * so once the sidebar has gone it waits at the window's leading edge for the drag that returns
 * it. Arrow keys do the same thing, because a control only a pointer can reach is out of reach
 * for anyone who does not use one.
 */
export function SidebarEdge() {
  const hidden = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <div
      aria-label="Sidebar edge"
      aria-orientation="vertical"
      aria-valuemax={SIDEBAR_WIDTH}
      aria-valuemin={0}
      aria-valuenow={hidden ? 0 : SIDEBAR_WIDTH}
      className="app-no-drag relative z-20 -mx-1 w-2 shrink-0 cursor-ew-resize"
      onKeyDown={onKeyDown}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        watchTheDrag(event.clientX);
      }}
      role="separator"
      tabIndex={0}
    />
  );
}

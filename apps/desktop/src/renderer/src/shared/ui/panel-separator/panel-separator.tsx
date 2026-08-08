import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

import { useEffect, useRef } from 'react';

import type { PanelBounds } from '../../lib';

import { draggedPanel, restoredPanel, steppedPanel } from '../../lib';

type PanelSeparatorProps = {
  /** What the separator sizes, spoken as its accessible name. */
  label: string;
  /** How wide the panel stands, and how wide it comes back at once a shut one is restored. */
  width: number;
  /** How wide it may stand, and how far a drag has to go to shut it or bring it back. */
  bounds: PanelBounds;
  /** Which edge of the panel this separator is, which decides which way a drag grows it. */
  panelEdge: 'leading' | 'trailing';
  /** Whether the panel has been put away, leaving this border as the way back to it. */
  shut?: boolean;
  /** Receives every width the drag or a key settles on. */
  onResize: (width: number) => void;
  /** Receives the ask to shut the panel, which a drag well past the narrowest width makes. */
  onCollapse: () => void;
  /** Receives the ask to bring a shut panel back, which a drag out of it makes. */
  onRestore: () => void;
  /** Receives the news that the gesture is over, so the width it left can be written down. */
  onSettled: () => void;
};

type Settling = {
  bounds: PanelBounds;
  onResize: (width: number) => void;
  onCollapse: () => void;
};

type Sizing = Settling & { width: number; toward: number };

const arrows: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

const reaches: Record<string, (bounds: PanelBounds) => number> = {
  Home: (bounds) => bounds.min,
  End: (bounds) => bounds.max,
};

function sizedByKey(key: string, sizing: Sizing): boolean {
  const arrow = arrows[key];

  if (arrow !== undefined) {
    sizing.onResize(steppedPanel(sizing.width, arrow * sizing.toward, sizing.bounds));

    return true;
  }

  const reach = reaches[key];

  if (reach !== undefined) {
    sizing.onResize(reach(sizing.bounds));

    return true;
  }

  if (key === 'Enter') {
    sizing.onCollapse();

    return true;
  }

  return false;
}

function restoredByKey(key: string, toward: number, onRestore: () => void): boolean {
  if (key === (toward === 1 ? 'ArrowRight' : 'ArrowLeft') || key === 'Enter') {
    onRestore();

    return true;
  }

  return false;
}

function settle(asked: number, settling: Settling): 'sized' | 'collapsed' {
  const standing = draggedPanel(asked, settling.bounds);

  if (standing.standing === 'collapsed') {
    settling.onCollapse();

    return 'collapsed';
  }

  settling.onResize(standing.width);

  return 'sized';
}

type Watching = {
  pointer: number;
  askedFrom: (at: number) => number;
  shut: boolean;
  settling: Settling;
  onRestore: () => void;
  onSettled: () => void;
};

function useEndedOnUnmount(dragging: RefObject<(() => void) | undefined>): void {
  useEffect(
    () => () => {
      dragging.current?.();
    },
    [dragging],
  );
}

function watchTheDrag(watching: Watching): () => void {
  const answer = (asked: number): boolean => {
    if (!watching.shut) {
      return settle(asked, watching.settling) === 'collapsed';
    }

    if (!restoredPanel(asked, watching.settling.bounds)) {
      return false;
    }

    watching.onRestore();

    return true;
  };

  const onMove = (moved: globalThis.PointerEvent): void => {
    if (moved.pointerId === watching.pointer && answer(watching.askedFrom(moved.clientX))) {
      stopWatching();
    }
  };

  const onEnd = (ended: globalThis.PointerEvent): void => {
    if (ended.pointerId === watching.pointer) {
      stopWatching();
    }
  };

  function stopWatching(): void {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    watching.onSettled();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);

  return stopWatching;
}

/**
 * The border between a panel and the surface beside it, which a person drags to resize the panel.
 *
 * @summary Reach for it on any panel a person should be able to size. Dragging sizes the panel
 * between the widths its content reads at, dragging well past the narrowest one shuts it, and
 * dragging back out of a shut one returns it at the width its owner last chose, so the border stays
 * the way back to a panel that has gone rather than a strip that does nothing. It carries the
 * window-splitter semantics whole, so arrow keys size it, Home and End reach the bounds, and Enter
 * shuts it and brings it back, because a border only a pointer can reach is out of reach for anyone
 * without one. Shutting or restoring ends the drag, since a pointer traveling on has nothing left
 * to say about a panel that already answered.
 */
export function PanelSeparator({
  label,
  width,
  bounds,
  panelEdge,
  shut = false,
  onResize,
  onCollapse,
  onRestore,
  onSettled,
}: PanelSeparatorProps) {
  const dragging = useRef<(() => void) | undefined>(undefined);
  const toward = panelEdge === 'trailing' ? 1 : -1;
  const standingWidth = shut ? 0 : width;

  useEndedOnUnmount(dragging);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const sizing = { width, bounds, toward, onResize, onCollapse };

    if (shut ? restoredByKey(event.key, toward, onRestore) : sizedByKey(event.key, sizing)) {
      event.preventDefault();
      onSettled();
    }
  };

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={bounds.max}
      aria-valuemin={0}
      aria-valuenow={standingWidth}
      className="app-no-drag relative z-20 -mx-1 w-2 shrink-0 cursor-ew-resize focus-ring"
      data-panel-control=""
      onKeyDown={onKeyDown}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        const from = event.clientX;

        dragging.current = watchTheDrag({
          pointer: event.pointerId,
          askedFrom: (at) => standingWidth + toward * (at - from),
          shut,
          settling: { bounds, onResize, onCollapse },
          onRestore,
          onSettled,
        });
      }}
      role="separator"
      tabIndex={0}
    />
  );
}

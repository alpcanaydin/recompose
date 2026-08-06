import type { KeyboardEvent, PointerEvent } from 'react';

import type { PanelBounds } from './panel-resize';

import { draggedPanel, steppedPanel } from './panel-resize';

type PanelSeparatorProps = {
  /** What the separator sizes, spoken as its accessible name. */
  label: string;
  /** How wide the panel stands right now. */
  width: number;
  /** How wide it may stand, and how far a drag has to go to shut it. */
  bounds: PanelBounds;
  /** Which side of the separator the panel sits on, which decides the way a drag reads. */
  side: 'leading' | 'trailing';
  /** Receives every width the drag or a key settles on. */
  onResize: (width: number) => void;
  /** Receives the ask to shut the panel, which a drag well past the narrowest width makes. */
  onCollapse: () => void;
};

type Settling = { onResize: (width: number) => void; onCollapse: () => void };

function settle(asked: number, bounds: PanelBounds, settling: Settling): void {
  const standing = draggedPanel(asked, bounds);

  if (standing.standing === 'collapsed') {
    settling.onCollapse();

    return;
  }

  settling.onResize(standing.width);
}

function watchTheDrag(
  pointer: number,
  askedFrom: (at: number) => number,
  bounds: PanelBounds,
  settling: Settling,
): void {
  const onMove = (moved: globalThis.PointerEvent): void => {
    if (moved.pointerId === pointer) {
      settle(askedFrom(moved.clientX), bounds, settling);
    }
  };

  const onEnd = (ended: globalThis.PointerEvent): void => {
    if (ended.pointerId === pointer) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
}

const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

/**
 * The border between a panel and the surface beside it, which a person drags to resize the panel.
 *
 * @summary Reach for it on any panel a person should be able to size. Dragging sizes the panel
 * between the widths its content reads at, and dragging well past the narrowest one shuts it, so the
 * gesture that resizes and the gesture that closes are the same motion rather than two controls. It
 * carries the window-splitter semantics whole, so arrow keys size it, Home and End reach the bounds,
 * and Enter shuts it, because a border only a pointer can reach is out of reach for anyone without
 * one.
 */
export function PanelSeparator({
  label,
  width,
  bounds,
  side,
  onResize,
  onCollapse,
}: PanelSeparatorProps) {
  const settling = { onResize, onCollapse };

  const askedFrom = (at: number, from: number): number =>
    side === 'leading' ? width + (from - at) : width + (at - from);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const direction = steps[event.key];

    if (direction !== undefined) {
      event.preventDefault();
      onResize(steppedPanel(width, direction, bounds));
    }

    if (event.key === 'Home') {
      onResize(bounds.min);
    }

    if (event.key === 'End') {
      onResize(bounds.max);
    }

    if (event.key === 'Enter') {
      onCollapse();
    }
  };

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={bounds.max}
      aria-valuemin={bounds.min}
      aria-valuenow={width}
      className="app-no-drag relative z-20 -mx-1 w-2 shrink-0 cursor-ew-resize focus-ring"
      onKeyDown={onKeyDown}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        const from = event.clientX;

        watchTheDrag(event.pointerId, (at) => askedFrom(at, from), bounds, settling);
      }}
      role="separator"
      tabIndex={0}
    />
  );
}

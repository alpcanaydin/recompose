import type { PanelName } from './panel-resize';

import { panelBounds } from './panel-resize';

const WIDTH_KEY = 'recompose.panel.width';

const held = new Map<PanelName, number>();

const readers = new Set<() => void>();

function tellReaders(): void {
  for (const reader of readers) {
    reader();
  }
}

function storedWidth(panel: PanelName): number | undefined {
  const written = localStorage.getItem(`${WIDTH_KEY}.${panel}`);
  const read = written === null ? Number.NaN : Number(written);

  return Number.isFinite(read) ? read : undefined;
}

/** Watches the panel widths, so a separator and the panel it sizes repaint together. */
export function subscribeToPanelWidths(reader: () => void): () => void {
  readers.add(reader);

  return () => {
    readers.delete(reader);
  };
}

/**
 * How wide a panel stands, which is the last width a person dragged it to.
 *
 * @summary The width outlives a collapse, so reopening a panel returns it to the width its owner
 * chose rather than to the one it shipped with. It outlives the session too, because a person who
 * sized a panel once meant it. What comes back is read against today's bounds rather than trusted,
 * so a width stored while the panel read at other sizes cannot stand it outside them.
 */
export function panelWidth(panel: PanelName): number {
  const bounds = panelBounds[panel];
  const asked = held.get(panel) ?? storedWidth(panel) ?? bounds.standing;

  return Math.min(Math.max(asked, bounds.min), bounds.max);
}

/** Takes the width a drag or an arrow key is passing through, without writing it down. */
export function setPanelWidth(panel: PanelName, width: number): void {
  held.set(panel, width);
  tellReaders();
}

/**
 * Writes down the width the panel came to rest at.
 *
 * @summary A drag passes through every width between where it started and where it stopped, and
 * only the last of them is a choice, so the disk hears the gesture once rather than once a frame.
 */
export function keepPanelWidth(panel: PanelName): void {
  localStorage.setItem(`${WIDTH_KEY}.${panel}`, String(panelWidth(panel)));
}

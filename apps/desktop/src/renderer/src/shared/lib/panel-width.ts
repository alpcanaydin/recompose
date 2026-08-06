const WIDTH_KEY = 'recompose.panel.width';

const standing = new Map<string, number>();

const readers = new Set<() => void>();

function tellReaders(): void {
  for (const reader of readers) {
    reader();
  }
}

function storedWidth(panel: string): number | undefined {
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
 * sized a panel once meant it.
 */
export function panelWidth(panel: string, standingWidth: number): number {
  const held = standing.get(panel) ?? storedWidth(panel);

  return held ?? standingWidth;
}

/** Remembers the width a drag or an arrow key settled the panel on. */
export function setPanelWidth(panel: string, width: number): void {
  standing.set(panel, width);
  localStorage.setItem(`${WIDTH_KEY}.${panel}`, String(width));
  tellReaders();
}

const readers = new Set<() => void>();

let open = true;

function tellReaders(): void {
  for (const reader of readers) {
    reader();
  }
}

/** Watches the inspector for changes, so the node, the toolbar and the drawer repaint together. */
export function subscribeToInspectorVisibility(reader: () => void): () => void {
  readers.add(reader);

  return () => {
    readers.delete(reader);
  };
}

/**
 * Whether the selected gateway's inspector stands open.
 *
 * @summary It opens with the app rather than remembering the last answer, because a gateway a
 * person has just navigated to is one they came to read, and the drawer is what reads it.
 */
export function inspectorOpen(): boolean {
  return open;
}

/**
 * Turns the inspector over, which is what both the gateway node and the toolbar control ask for.
 *
 * @summary Two controls drive one panel, so they share this answer rather than each holding their
 * own. That is what stops the toolbar from reading closed while the node reads selected.
 */
export function toggleInspector(): void {
  open = !open;
  tellReaders();
}

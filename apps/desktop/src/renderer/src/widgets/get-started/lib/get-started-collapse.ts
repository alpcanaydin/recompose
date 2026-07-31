const COLLAPSE_KEY = 'recompose.get-started.collapsed';

const readers = new Set<() => void>();

function tellReaders(): void {
  for (const reader of readers) {
    reader();
  }
}

/** Watches the fold for changes, so the panel repaints when it moves. */
export function subscribeToGetStartedCollapse(reader: () => void): () => void {
  readers.add(reader);

  return () => {
    readers.delete(reader);
  };
}

/** Whether the person has folded the checklist down to its header and its progress. */
export function getStartedCollapsed(): boolean {
  return localStorage.getItem(COLLAPSE_KEY) !== null;
}

/** Folds the checklist away, leaving the header and the progress line standing. */
export function collapseGetStarted(): void {
  localStorage.setItem(COLLAPSE_KEY, 'true');
  tellReaders();
}

/** Opens the checklist back up to its steps and its way out. */
export function expandGetStarted(): void {
  localStorage.removeItem(COLLAPSE_KEY);
  tellReaders();
}

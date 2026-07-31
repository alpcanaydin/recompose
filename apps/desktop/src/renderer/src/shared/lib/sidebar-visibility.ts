const HIDDEN_KEY = 'recompose.sidebar.hidden';

const readers = new Set<() => void>();

function tellReaders(): void {
  for (const reader of readers) {
    reader();
  }
}

/** Watches the sidebar for changes, so both the shell and the toggle repaint together. */
export function subscribeToSidebarVisibility(reader: () => void): () => void {
  readers.add(reader);

  return () => {
    readers.delete(reader);
  };
}

/** Whether the person has put the sidebar away, leaving the surface its full width. */
export function sidebarHidden(): boolean {
  return localStorage.getItem(HIDDEN_KEY) !== null;
}

/** Puts the sidebar away. */
export function hideSidebar(): void {
  localStorage.setItem(HIDDEN_KEY, 'true');
  tellReaders();
}

/** Brings the sidebar back. */
export function showSidebar(): void {
  localStorage.removeItem(HIDDEN_KEY);
  tellReaders();
}

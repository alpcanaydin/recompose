const DISMISSAL_KEY = 'recompose.get-started.dismissed';

const readers = new Set<() => void>();

function tellReaders(): void {
  for (const reader of readers) {
    reader();
  }
}

/** Watches the dismissal for changes, so a surface reading it repaints when it moves. */
export function subscribeToGetStartedDismissal(reader: () => void): () => void {
  readers.add(reader);

  return () => {
    readers.delete(reader);
  };
}

/** Whether the person has already waved the coaching card away. */
export function getStartedDismissed(): boolean {
  return localStorage.getItem(DISMISSAL_KEY) !== null;
}

/** Remembers that the card is unwelcome, so it stays away across sessions. */
export function dismissGetStarted(): void {
  localStorage.setItem(DISMISSAL_KEY, 'true');
  tellReaders();
}

/** Forgets the dismissal, which is what the View menu's way back does. */
export function restoreGetStarted(): void {
  localStorage.removeItem(DISMISSAL_KEY);
  tellReaders();
}

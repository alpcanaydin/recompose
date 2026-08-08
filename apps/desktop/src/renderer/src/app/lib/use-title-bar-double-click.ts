import { useEffect } from 'react';

function overABareDragRegion(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('.app-no-drag') === null &&
    target.closest('.app-drag') !== null
  );
}

/**
 * Asks the window to zoom or minimize when a person double-clicks the title bar.
 *
 * @summary A hidden title bar under a custom drag region is given none of the platform's own
 * double-click-to-zoom, so the drag region asks the main process to do what the person set their
 * macOS double-click preference to. Only the bare drag region counts: a double-click that lands on a
 * control sitting in the bar is that control's to answer, not the window's, which is why a no-drag
 * ancestor takes the event out of the window's hands.
 */
export function useTitleBarDoubleClick(): void {
  useEffect(() => {
    const onDoubleClick = (clicked: MouseEvent): void => {
      if (overABareDragRegion(clicked.target)) {
        void window.recompose['system:title-bar-double-click']();
      }
    };

    document.addEventListener('dblclick', onDoubleClick);

    return () => {
      document.removeEventListener('dblclick', onDoubleClick);
    };
  }, []);
}

import type { ReactNode } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import { Icon } from './icon';

type DrawerProps = {
  /** Whether the drawer stands on screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal. */
  onOpenChange: (open: boolean) => void;
  /** Name of the drawer, shown at its head and carried as the dialog's accessible name. */
  title: string;
  /** The browse surface the drawer holds, which scrolls on its own when it outgrows the panel. */
  children: ReactNode;
};

/**
 * Panel anchored to the trailing edge, opening beside the screen and settling nothing on close.
 *
 * @summary Reach for it when a person browses or inspects something and the surface behind should
 * stay where it was. It carries a heading with the close control at that heading's trailing edge
 * and no footer. Reach for the sheet instead when the person owes the surface a decision, because
 * a sheet's footer is where that decision gets taken.
 */
export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-scrim" />
        <Dialog.Popup className="drawer-surface">
          <header className="flex items-center gap-2 border-b border-line-faint px-4.5 py-3.25">
            <Dialog.Title className="text-sheet-title text-ink">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="ms-auto flex size-6 items-center justify-center rounded-control text-ink-secondary focus-ring hover:bg-surface-hover active:bg-surface-pressed"
            >
              <Icon className="size-4" name="close" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4.5 py-3.5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

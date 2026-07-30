import type { ReactNode, RefObject } from 'react';

import { Dialog } from '@base-ui/react/dialog';

type SheetProps = {
  /** Whether the sheet stands on screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal. */
  onOpenChange: (open: boolean) => void;
  /** Name of the sheet, shown at its head and carried as the dialog's accessible name. */
  title: string;
  /** One line under the title saying what the sheet is for. */
  description: string;
  /** Control that takes focus the moment the sheet opens. */
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  /** Actions that settle the sheet, laid out at its foot. */
  footer: ReactNode;
  /** The body of the sheet, usually a stack of fields. */
  children: ReactNode;
};

/**
 * Centered modal surface that takes one decision and hands the screen back.
 *
 * @summary Reach for it when a person needs to supply something before the surface behind can
 * change, and the surface behind should stay in view. It dims what it covers, traps focus, and
 * lands focus on the control the caller names rather than on the sheet itself.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  footer,
  children,
}: SheetProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-scrim" />
        <Dialog.Popup className="sheet-surface flex flex-col gap-4" initialFocus={initialFocus}>
          <header className="flex flex-col gap-1">
            <Dialog.Title className="text-heading text-ink">{title}</Dialog.Title>
            <Dialog.Description className="text-body text-ink-secondary">
              {description}
            </Dialog.Description>
          </header>
          {children}
          <footer className="flex justify-end gap-2">{footer}</footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

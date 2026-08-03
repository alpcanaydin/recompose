import type { ReactNode, RefObject } from 'react';

import { Dialog } from '@base-ui/react/dialog';
import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '../icon/icon';

const SheetFootContext = createContext<HTMLElement | null>(null);

function useFollowedHeight(open: boolean) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [grown, setGrown] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (grown === null || !open) {
      setHeight(undefined);

      return undefined;
    }

    const follow = new ResizeObserver(() => {
      setHeight(grown.offsetHeight);
    });

    follow.observe(grown);

    return () => {
      follow.disconnect();
    };
  }, [grown, open]);

  return { inner: setGrown, height };
}

/**
 * Carries an act into the sheet's foot from wherever its state lives.
 *
 * @summary Reach for it inside a sheet's body when the act that settles the sheet needs state
 * only the body holds. The act renders beside the sheet's own foot actions, so every settle act
 * reads in one place. Outside a sheet it renders in place, so a surface under test or in a story
 * still offers the act.
 */
export function SheetActionSlot({ children }: { children: ReactNode }): ReactNode {
  const foot = useContext(SheetFootContext);

  return foot === null ? children : createPortal(children, foot);
}

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
  /** Widens the surface for content that reads as a grid rather than a stack of fields. */
  wide?: boolean;
  /** Steps back to the surface the sheet showed before, standing leading the title. */
  onBack?: (() => void) | undefined;
  /** The body of the sheet, usually a stack of fields. */
  children: ReactNode;
};

function sheetHead(
  title: string,
  description: string,
  onBack: (() => void) | undefined,
): ReactNode {
  return (
    <header className="flex items-start gap-2 px-4.5 pt-4.5 pb-3.25">
      {onBack === undefined ? null : (
        <button
          aria-label="Back"
          className="flex h-6 w-7 items-center justify-center rounded-control text-ink-secondary focus-ring row-hover"
          onClick={onBack}
          type="button"
        >
          <Icon className="size-4 rotate-90" name="chevron" />
        </button>
      )}
      <div>
        <Dialog.Title className="block text-heading text-ink">{title}</Dialog.Title>
        <Dialog.Description className="mt-0.75 text-detail text-ink-secondary">
          {description}
        </Dialog.Description>
      </div>
    </header>
  );
}

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
  wide = false,
  onBack,
  children,
}: SheetProps) {
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  const body = useFollowedHeight(open);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-scrim" />
        <Dialog.Popup
          className={`sheet-surface ${wide ? 'sheet-wide' : ''}`}
          initialFocus={initialFocus}
        >
          {sheetHead(title, description, onBack)}
          <div
            className="sheet-body-resize"
            style={body.height === undefined ? undefined : { height: body.height }}
          >
            <div className="px-4.5 pb-3.75" ref={body.inner}>
              <SheetFootContext.Provider value={foot}>{children}</SheetFootContext.Provider>
            </div>
          </div>
          <footer className="sheet-actions" ref={setFoot}>
            {footer}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

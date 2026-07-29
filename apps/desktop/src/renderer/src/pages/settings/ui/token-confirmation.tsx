import { useEffect, useRef } from 'react';

import { placeFocus } from '../../../shared/ui';
import { RowAction } from './row-action';

type TokenConfirmationProps = {
  /** Abandons the regeneration and returns the row to its mask. */
  onCancel: () => void;
  /** Mints the replacement, and with it retires every client holding the old one. */
  onConfirm: () => void;
};

/**
 * The second phase of a regeneration: the safe choice, focused, beside the destructive one.
 *
 * @summary Reach for it when an act cannot be undone and the row must say so before it happens.
 */
export function TokenConfirmation({ onCancel, onConfirm }: TokenConfirmationProps) {
  const safeChoice = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    placeFocus(safeChoice.current);
  }, []);

  return (
    <>
      <RowAction onClick={onCancel} ref={safeChoice}>
        Cancel
      </RowAction>
      <RowAction onClick={onConfirm} tone="destructive">
        Regenerate
      </RowAction>
    </>
  );
}

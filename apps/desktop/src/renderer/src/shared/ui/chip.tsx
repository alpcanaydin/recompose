import type { ReactNode } from 'react';

import { Toggle } from '@base-ui/react/toggle';

type ChipProps = {
  /** Whether this chip currently narrows the list. */
  selected: boolean;
  /** Receives the state the person asked for. */
  onSelectedChange: (selected: boolean) => void;
  /** What the chip narrows by, which is also the name it answers to. */
  children: ReactNode;
};

/**
 * One narrowing of a list, which a person turns on and off beside its siblings.
 *
 * @summary Reach for it when a list is longer than a screen and a person wants less of it. Reach
 * for the segmented control instead when the choices are mutually exclusive and one of them always
 * stands, because a chip may end up carrying nothing while a segment never does.
 */
export function Chip({ selected, onSelectedChange, children }: ChipProps) {
  return (
    <Toggle
      className="flex h-chip items-center rounded-chip border border-transparent px-2 text-control text-ink focus-ring row-hover data-pressed:chip-selected"
      onPressedChange={onSelectedChange}
      pressed={selected}
    >
      {children}
    </Toggle>
  );
}

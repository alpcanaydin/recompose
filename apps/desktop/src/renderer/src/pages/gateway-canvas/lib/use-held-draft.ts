import { useCallback, useMemo, useState } from 'react';

import type { SettledDefinition } from './model-draft';

import { draftKept, emptyDefinition } from './model-draft';

export type HeldDraft = {
  /** The draft standing in the add flow, or nothing while the drawer reads what serves. */
  standing: SettledDefinition | undefined;
  /** Begins a fresh definition. */
  startDrafting: () => void;
  /** Holds what the flow hands back as it leaves the screen unfinished. */
  keepDrafting: (values: SettledDefinition) => void;
  /** Drops the draft, which a finished save and a cancel both do. */
  leaveDrafting: () => void;
};

/**
 * The definition a person is drafting, held above the drawer so shutting it puts the work down.
 *
 * @summary The draft lives here rather than inside the drawer, so closing the inspector
 * mid-definition sets the work aside instead of throwing it away, and reopening finds it as it was.
 */
export function useHeldDraft(): HeldDraft {
  const [standing, setStanding] = useState<SettledDefinition | undefined>(undefined);

  const keepDrafting = useCallback((values: SettledDefinition) => {
    setStanding((held) => draftKept(held, values));
  }, []);

  return useMemo(
    () => ({
      standing,
      startDrafting: () => {
        setStanding(emptyDefinition());
      },
      keepDrafting,
      leaveDrafting: () => {
        setStanding(undefined);
      },
    }),
    [standing, keepDrafting],
  );
}

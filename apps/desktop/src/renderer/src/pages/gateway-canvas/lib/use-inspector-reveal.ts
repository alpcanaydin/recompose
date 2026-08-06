import { useEffect, useState } from 'react';

/**
 * How long the inspector takes to arrive and to leave, which `inspector-panel` paints in CSS.
 *
 * @summary The pair has to agree: the panel is held on screen for exactly as long as its leaving
 * animation runs, so shortening one without the other either cuts the motion off or leaves a panel
 * standing after it finished.
 */
const INSPECTOR_MOTION_MS = 150;

/**
 * Whether the inspector belongs on screen, holding it there while it leaves.
 *
 * @summary An element that unmounts the instant its state flips never plays an exit, so the drawer
 * opens with motion and vanishes with a cut. This keeps it mounted for the length of that exit and
 * drops it after, which is what makes closing read as the reverse of opening rather than a glitch.
 */
export function useInspectorReveal(open: boolean) {
  const [leaving, setLeaving] = useState(false);
  const [stood, setStood] = useState(open);

  if (open !== stood) {
    setStood(open);
    setLeaving(!open);
  }

  useEffect(() => {
    if (!leaving) {
      return undefined;
    }

    const settling = setTimeout(() => {
      setLeaving(false);
    }, INSPECTOR_MOTION_MS);

    return () => {
      clearTimeout(settling);
    };
  }, [leaving]);

  return { rendered: open || leaving, leaving };
}

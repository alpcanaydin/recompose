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
 * Whether this machine welcomes motion, which decides if there is an exit to wait for at all.
 *
 * @summary The exit animation only exists under the same query, so holding the panel on screen
 * without it would stand a full-width panel still for the length of an animation nobody asked for
 * and then cut it, which is the very thing the wait exists to prevent.
 */
function motionWelcome(): boolean {
  return window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

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
    setLeaving(!open && motionWelcome());
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

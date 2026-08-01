/** How far the pointer goes along the edge before the drag means to move the sidebar. */
export const TRAVEL_TO_FLIP = 48;

export type SidebarGesture = 'shown' | 'hidden' | 'unchanged';

/**
 * What a drag along the sidebar's edge asks for, given how far it went and which way.
 *
 * @summary A pointer wanders a few pixels while a person presses, so a gesture acting on the
 * first pixel would move the sidebar every time somebody grazed the edge. Travel towards the
 * sidebar asks for it to go, travel out from it asks for it back, and anything shorter asks
 * for nothing.
 */
export function sidebarGestureFrom(travel: number): SidebarGesture {
  if (Math.abs(travel) < TRAVEL_TO_FLIP) {
    return 'unchanged';
  }

  return travel < 0 ? 'hidden' : 'shown';
}

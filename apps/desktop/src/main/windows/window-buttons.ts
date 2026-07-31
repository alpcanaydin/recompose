const CONTROL_HEIGHT = 12;
const TOOLBAR_HEIGHT = 54;
const SIDEBAR_BAND_HEIGHT = 36;
const LEADING_INSET = 14;

function centeredIn(bandHeight: number): number {
  return (bandHeight - CONTROL_HEIGHT) / 2;
}

/**
 * Where macOS should draw its window controls, which depends on what they sit over.
 *
 * @summary A hidden title bar leaves the controls floating over whatever the renderer draws
 * underneath. With the sidebar standing they sit over its top band; with the sidebar away they
 * join the toolbar's row of controls, and a row of buttons beside a cluster drawn to a different
 * centre reads as a mistake. So the position follows the sidebar rather than staying put.
 */
export function windowButtonsFor(sidebarShown: boolean): { x: number; y: number } {
  return {
    x: LEADING_INSET,
    y: centeredIn(sidebarShown ? SIDEBAR_BAND_HEIGHT : TOOLBAR_HEIGHT),
  };
}

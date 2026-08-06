import type { RefObject } from 'react';

import { useEffect } from 'react';

import { pressedAPanelControl } from '../../../shared/lib';

/**
 * Puts a standing panel away when a person presses the surface around it but not the panel itself.
 *
 * @summary The listener lives on the surface that holds the panel, not the whole document, so a
 * press on the toolbar or the status bar runs that control and leaves the panel alone: reaching for
 * a control elsewhere in the window is using the app, not looking away from the panel. Inside the
 * surface, anything that already speaks for the panel is exempt, which keeps the control that toggles
 * it from closing and reopening it in one gesture and keeps a drag on its border from reading as a
 * look away. It listens only while the panel stands, so a press on a closed one opens nothing.
 */
export function usePressAway(
  surface: RefObject<HTMLElement | null>,
  standing: boolean,
  dismiss: () => void,
): void {
  useEffect(() => {
    const region = surface.current;

    if (!standing || region === null) {
      return undefined;
    }

    const onPress = (pressed: PointerEvent): void => {
      if (!pressedAPanelControl(pressed.composedPath())) {
        dismiss();
      }
    };

    region.addEventListener('pointerdown', onPress);

    return () => {
      region.removeEventListener('pointerdown', onPress);
    };
  }, [surface, standing, dismiss]);
}

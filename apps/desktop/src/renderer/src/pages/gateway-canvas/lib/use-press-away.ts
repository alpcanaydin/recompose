import { useEffect } from 'react';

import { pressedAPanelControl } from '../../../shared/lib';

/**
 * Puts a standing panel away when a person presses anywhere that is not the panel or its controls.
 *
 * @summary Reaching for something else on screen says the panel is done with more plainly than
 * finding the control that opened it, so the press that lands elsewhere closes it. Anything that
 * already speaks for the panel is exempt, which is what keeps the control that toggles it from
 * closing and reopening it in one gesture and keeps a drag on its border from reading as a person
 * looking away. It listens only while the panel stands, so a press on a closed one opens nothing.
 */
export function usePressAway(standing: boolean, dismiss: () => void): void {
  useEffect(() => {
    if (!standing) {
      return undefined;
    }

    const onPress = (pressed: PointerEvent): void => {
      if (!pressedAPanelControl(pressed.composedPath())) {
        dismiss();
      }
    };

    document.addEventListener('pointerdown', onPress);

    return () => {
      document.removeEventListener('pointerdown', onPress);
    };
  }, [standing, dismiss]);
}

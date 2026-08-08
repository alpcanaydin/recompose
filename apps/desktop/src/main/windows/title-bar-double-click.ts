export type WindowZoomActions = {
  isMaximized: () => boolean;
  maximize: () => void;
  unmaximize: () => void;
  minimize: () => void;
};

export type TitleBarDoubleClickAction = 'zoom' | 'minimize' | 'none';

/**
 * What the person's macOS "double-click title bar to" preference asks a title-bar double-click to do.
 *
 * @summary macOS reports this as the AppleActionOnDoubleClick default. A hidden title bar under a
 * custom drag region is given none of this behavior for free, so the app reads the same preference
 * and honours it rather than inventing one. Anything other than the two named actions is a request
 * for nothing, which is what a person who turned the behavior off has asked for.
 */
export function titleBarDoubleClickAction(preference: string | null): TitleBarDoubleClickAction {
  if (preference === 'Maximize') {
    return 'zoom';
  }

  if (preference === 'Minimize') {
    return 'minimize';
  }

  return 'none';
}

function zoom(window: WindowZoomActions): void {
  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
}

/**
 * Performs the person's chosen double-click action on the window they double-clicked.
 *
 * @summary Zoom toggles rather than only growing, so a second double-click puts a zoomed window
 * back the way the platform's own title bar would. A window that closed between the press and this
 * message arriving is nothing to act on.
 */
export function performTitleBarDoubleClick(
  window: WindowZoomActions | undefined,
  preference: string | null,
): void {
  if (window === undefined) {
    return;
  }

  const action = titleBarDoubleClickAction(preference);

  if (action === 'zoom') {
    zoom(window);
  } else if (action === 'minimize') {
    window.minimize();
  }
}

const SERVED_RENDERER = 'app://renderer/index.html';

export const SETTINGS_SHORTCUT_ROUTE = '/settings?focus=first-control';

export function rendererBaseFor(development: boolean, devServerUrl: string | undefined): string {
  if (!development || devServerUrl === undefined || devServerUrl === '') {
    return SERVED_RENDERER;
  }

  return devServerUrl;
}

export function rendererUrlFor(base: string, route: string): string {
  return `${base}#${route}`;
}

/**
 * The settings route stamped with the press that asked for it.
 *
 * @summary Every press has to differ from the last, or the router treats the second one as the
 * same location and the focus request never runs again.
 */
export function settingsShortcutRouteFor(press: number): string {
  return `${SETTINGS_SHORTCUT_ROUTE}&at=${String(press)}`;
}

/**
 * The creation sheet opened over the canvas, whatever surface a person stands on.
 *
 * @summary A gateway is born on the canvas, so the sheet asks its questions over the surface the
 * answer lands on rather than over a settings list the new gateway has nothing to do with.
 */
export function newGatewayRouteFor(press: number): string {
  return `/?create=true&at=${String(press)}`;
}

export function getStartedRouteFor(press: number): string {
  return `/?getStarted=true&at=${String(press)}`;
}

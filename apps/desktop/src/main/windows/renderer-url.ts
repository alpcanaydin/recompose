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

const HOME_SURFACE = '/';

/** The route a loaded window stands on, read back out of its fragment. */
export function surfaceRouteOf(loadedUrl: string): string {
  const [, fragment = ''] = loadedUrl.split('#');
  const [route = ''] = fragment.split('?');

  return route === '' ? HOME_SURFACE : route;
}

/**
 * The creation sheet opened over the surface the person is already on.
 *
 * @summary The sheet mounts in the root layout, so every surface can carry it. Naming the
 * current surface is what keeps the shortcut from throwing away the screen someone was reading.
 */
export function newGatewayRouteFor(press: number, surface: string = HOME_SURFACE): string {
  return `${surface}?create=true&at=${String(press)}`;
}

export function getStartedRouteFor(press: number): string {
  return `/?getStarted=true&at=${String(press)}`;
}

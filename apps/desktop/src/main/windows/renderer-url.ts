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

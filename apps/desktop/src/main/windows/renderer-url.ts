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

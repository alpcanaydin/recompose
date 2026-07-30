/**
 * Every permission recompose grants, enumerated so a second one cannot arrive unnoticed.
 *
 * @summary The address pill copies a gateway's origin, which Chromium gates behind
 * clipboard-sanitized-write. Nothing else in the app has ever needed a permission.
 */
export const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set(['clipboard-sanitized-write']);

export function allowsPermission(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission);
}

import { session } from 'electron';

import { allowsPermission } from './permission-policy';

export function registerPermissionHandlers(): void {
  const permissionRequestHandler = (
    _webContents: unknown,
    permission: string,
    callback: (allowed: boolean) => void,
  ) => {
    callback(allowsPermission(permission));
  };

  session.defaultSession.setPermissionRequestHandler(permissionRequestHandler);

  const permissionCheckHandler = (_webContents: unknown, permission: string) =>
    allowsPermission(permission);

  session.defaultSession.setPermissionCheckHandler(permissionCheckHandler);
}

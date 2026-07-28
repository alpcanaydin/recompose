export function shouldQuitOnLastWindowClose(
  platform: NodeJS.Platform,
  menuBarVisible: boolean,
): boolean {
  if (platform === 'darwin') {
    return false;
  }

  return !menuBarVisible;
}

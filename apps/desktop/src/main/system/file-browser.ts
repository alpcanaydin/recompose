import type { SystemState } from '@recompose/contracts';

export type FileBrowser = SystemState['fileBrowser'];

export function fileBrowserFor(platform: NodeJS.Platform): FileBrowser {
  if (platform === 'darwin') {
    return 'finder';
  }

  return platform === 'win32' ? 'explorer' : 'file-manager';
}

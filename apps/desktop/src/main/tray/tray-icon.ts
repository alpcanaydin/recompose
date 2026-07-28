export type TrayIconSources = {
  template: string;
  coloured: string;
};

export function trayIconSourceFor(platform: NodeJS.Platform, sources: TrayIconSources): string {
  return platform === 'darwin' ? sources.template : sources.coloured;
}

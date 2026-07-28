export type TrayIconSources = {
  template: string;
  templateRetina: string;
  coloured: string;
};

export type TrayIcon = {
  source: string;
  retinaSource: string | null;
  template: boolean;
};

export function trayIconFor(platform: NodeJS.Platform, sources: TrayIconSources): TrayIcon {
  if (platform === 'darwin') {
    return { source: sources.template, retinaSource: sources.templateRetina, template: true };
  }

  return { source: sources.coloured, retinaSource: null, template: false };
}

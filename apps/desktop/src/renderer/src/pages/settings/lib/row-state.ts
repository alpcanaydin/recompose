import type { SystemState } from '@recompose/contracts';

const revealLabels: Record<SystemState['fileBrowser'], string> = {
  finder: 'Reveal in Finder',
  explorer: 'Show in Explorer',
  'file-manager': 'Open folder',
};

export function revealLabelFor(fileBrowser: SystemState['fileBrowser']): string {
  return revealLabels[fileBrowser];
}

type LaunchAtLoginRow = {
  rendered: boolean;
  inert: boolean;
  reason?: string;
};

export function launchAtLoginRow(availability: SystemState['loginItem']): LaunchAtLoginRow {
  if (availability === 'unsupported') {
    return { rendered: false, inert: true };
  }

  if (availability === 'unpackaged') {
    return {
      rendered: true,
      inert: true,
      reason: 'A development build cannot register itself as a login item.',
    };
  }

  return { rendered: true, inert: false };
}

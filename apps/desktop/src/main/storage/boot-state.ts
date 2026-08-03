import { defaultSettings, type Settings } from '@recompose/contracts';

import { initializeStorage } from './initialize-storage';

export type BootState = { settings: Settings; slugs: string[] };

export async function storedBootState(
  userDataPath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<BootState> {
  try {
    const state = await initializeStorage(userDataPath, onCorrupt);

    return { settings: state.settings, slugs: state.gateways.map((gateway) => gateway.slug) };
  } catch (error) {
    console.error('storage initialization failed', error);

    return { settings: defaultSettings(), slugs: [] };
  }
}

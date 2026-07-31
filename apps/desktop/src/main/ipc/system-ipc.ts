import type { SystemState } from '@recompose/contracts';

import type { FileBrowser } from '../system/file-browser';
import type { LoginItemAvailability } from '../system/login-item';
import type { IpcHandlers } from './dispatch';

import { homeRelative } from '../system/home-relative';
import { windowButtonsFor } from '../windows/window-buttons';
import { ipcFailure } from './storage-envelope';

export type SystemIpcContext = {
  fileBrowser: FileBrowser;
  loginItem: LoginItemAvailability;
  configFolder: string;
  homeFolder: string;
  readLoginItem: () => boolean;
  isMenuBarVisible: () => boolean;
  openFolder: (path: string) => Promise<string>;
  /** Moves the window controls to the band they now sit over. */
  placeWindowButtons: (position: { x: number; y: number }) => void;
};

export type SystemIpcHandlers = Pick<
  IpcHandlers,
  'system:get' | 'system:open-config-folder' | 'system:sidebar-shown'
>;

function observeSystem(ctx: SystemIpcContext): SystemState {
  return {
    fileBrowser: ctx.fileBrowser,
    loginItem: ctx.loginItem,
    loginItemEnabled: ctx.readLoginItem(),
    menuBarVisible: ctx.isMenuBarVisible(),
    configFolder: homeRelative(ctx.configFolder, ctx.homeFolder),
  };
}

async function openConfigFolder(ctx: SystemIpcContext) {
  const failure = await ctx.openFolder(ctx.configFolder);

  if (failure !== '') {
    return ipcFailure('folder-open-failed', `could not open the config folder: ${failure}`);
  }

  return { ok: true as const, value: undefined };
}

function placedWindowButtons(ctx: SystemIpcContext, shown: boolean) {
  ctx.placeWindowButtons(windowButtonsFor(shown));

  return { ok: true as const, value: undefined };
}

export function createSystemIpcHandlers(ctx: SystemIpcContext): SystemIpcHandlers {
  return {
    'system:get': async () => Promise.resolve({ ok: true as const, value: observeSystem(ctx) }),
    'system:open-config-folder': async () => openConfigFolder(ctx),
    'system:sidebar-shown': async (shown) => Promise.resolve(placedWindowButtons(ctx, shown)),
  };
}

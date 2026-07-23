import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { AllowedOrigins, TrustedSender } from './sender-trust';

import { dispatchIpc, ipcChannelNames, type IpcHandlers } from './dispatch';

function senderFromEvent(event: IpcMainInvokeEvent): TrustedSender {
  const { senderFrame } = event;

  if (senderFrame === null) {
    return { frameUrl: null, isMainFrame: false };
  }

  return { frameUrl: senderFrame.url, isMainFrame: senderFrame === event.sender.mainFrame };
}

function devServerOrigin(): string | undefined {
  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  return rendererUrl === undefined ? undefined : new URL(rendererUrl).origin;
}

export function registerIpcHandlers(handlers: IpcHandlers): void {
  const allowedOrigins: AllowedOrigins = { devServerOrigin: devServerOrigin() };

  for (const channel of ipcChannelNames) {
    ipcMain.handle(channel, async (event, payload: unknown) =>
      dispatchIpc(handlers, channel, payload, senderFromEvent(event), allowedOrigins),
    );
  }
}

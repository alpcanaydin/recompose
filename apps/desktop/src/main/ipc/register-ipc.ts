import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { AllowedOrigins, TrustedSender } from './sender-trust';

import { devServerOrigin } from '../environment/dev-server-origin';
import { dispatchIpc, ipcChannelNames, type IpcHandlers } from './dispatch';

function senderFromEvent(event: IpcMainInvokeEvent): TrustedSender {
  const { senderFrame } = event;

  if (senderFrame === null) {
    return { frameUrl: null, isMainFrame: false };
  }

  return { frameUrl: senderFrame.url, isMainFrame: senderFrame === event.sender.mainFrame };
}

export function registerIpcHandlers(handlers: IpcHandlers): void {
  const allowedOrigins: AllowedOrigins = { devServerOrigin: devServerOrigin() };

  for (const channel of ipcChannelNames) {
    ipcMain.handle(channel, async (event, payload: unknown) =>
      dispatchIpc(handlers, channel, payload, senderFromEvent(event), allowedOrigins),
    );
  }
}

import type { EngineStates } from '@recompose/contracts';

import { BrowserWindow } from 'electron';

export function pushEngineStates(states: EngineStates): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('engine:state', states);
  }
}

export function pushAccountsChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('accounts:changed', 'changed');
  }
}

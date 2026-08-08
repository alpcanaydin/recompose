import type { EngineStates } from '@recompose/contracts';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { pushAccountsChanged, pushEngineStates } from './push-events';

type Delivery = { channel: string; payload: unknown };

type OpenWindow = { webContents: { send: (channel: string, payload: unknown) => void } };

const desktop = vi.hoisted((): { open: OpenWindow[] } => ({ open: [] }));

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: (): OpenWindow[] => desktop.open },
}));

function openWindow(): Delivery[] {
  const delivered: Delivery[] = [];

  desktop.open.push({
    webContents: {
      send: (channel, payload) => {
        delivered.push({ channel, payload });
      },
    },
  });

  return delivered;
}

beforeEach(() => {
  desktop.open = [];
});

describe('telling the open windows what changed', () => {
  test('a new engine state reaches every open window', () => {
    const first = openWindow();
    const second = openWindow();
    const states: EngineStates = { 'my-gateway': { status: 'running' } };

    pushEngineStates(states);

    expect(first).toEqual([{ channel: 'engine:state', payload: states }]);
    expect(second).toEqual([{ channel: 'engine:state', payload: states }]);
  });

  test('a changed account list reaches every open window', () => {
    const first = openWindow();
    const second = openWindow();

    pushAccountsChanged();

    expect(first).toEqual([{ channel: 'accounts:changed', payload: 'changed' }]);
    expect(second).toEqual([{ channel: 'accounts:changed', payload: 'changed' }]);
  });
});

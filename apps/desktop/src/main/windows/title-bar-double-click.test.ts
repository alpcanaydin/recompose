import { describe, expect, test, vi } from 'vitest';

import { performTitleBarDoubleClick, titleBarDoubleClickAction } from './title-bar-double-click';

function fakeWindow(maximized: boolean) {
  return {
    isMaximized: () => maximized,
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    minimize: vi.fn(),
  };
}

describe('what the macOS double-click preference asks for', () => {
  test('Maximize asks the window to zoom', () => {
    expect(titleBarDoubleClickAction('Maximize')).toBe('zoom');
  });

  test('Minimize asks the window to minimize', () => {
    expect(titleBarDoubleClickAction('Minimize')).toBe('minimize');
  });

  test('None asks for nothing, and so does an unset preference', () => {
    expect(titleBarDoubleClickAction('None')).toBe('none');
    expect(titleBarDoubleClickAction(null)).toBe('none');
    expect(titleBarDoubleClickAction('')).toBe('none');
  });
});

describe('performing the double-click on the focused window', () => {
  test('Maximize zooms a window that is not already zoomed', () => {
    const window = fakeWindow(false);

    performTitleBarDoubleClick(window, 'Maximize');

    expect(window.maximize).toHaveBeenCalledTimes(1);
    expect(window.unmaximize).not.toHaveBeenCalled();
  });

  test('Maximize on an already zoomed window puts it back', () => {
    const window = fakeWindow(true);

    performTitleBarDoubleClick(window, 'Maximize');

    expect(window.unmaximize).toHaveBeenCalledTimes(1);
    expect(window.maximize).not.toHaveBeenCalled();
  });

  test('Minimize sends the window to the dock', () => {
    const window = fakeWindow(false);

    performTitleBarDoubleClick(window, 'Minimize');

    expect(window.minimize).toHaveBeenCalledTimes(1);
  });

  test('None touches the window not at all', () => {
    const window = fakeWindow(false);

    performTitleBarDoubleClick(window, 'None');

    expect(window.maximize).not.toHaveBeenCalled();
    expect(window.unmaximize).not.toHaveBeenCalled();
    expect(window.minimize).not.toHaveBeenCalled();
  });

  test('a window that closed before the message arrived is nothing to act on', () => {
    expect(() => {
      performTitleBarDoubleClick(undefined, 'Maximize');
    }).not.toThrow();
  });
});

import { describe, expect, test } from 'vitest';

import { windowButtonsFor, windowButtonsMoveOn } from './window-buttons';

describe('where macOS draws the window controls', () => {
  test('the controls centre in the sidebar band while the sidebar stands', () => {
    expect(windowButtonsFor(true)).toEqual({ x: 14, y: 12 });
  });

  test('the controls centre in the toolbar row once the sidebar is away', () => {
    expect(windowButtonsFor(false)).toEqual({ x: 14, y: 21 });
  });

  test('the controls keep one leading inset, so nothing shifts sideways as the sidebar moves', () => {
    expect(windowButtonsFor(true).x).toBe(windowButtonsFor(false).x);
  });
});

describe('which platforms place their own window controls', () => {
  test('macOS draws them over the renderer, so the position is ours to set', () => {
    expect(windowButtonsMoveOn('darwin')).toBe(true);
  });

  test('every other platform draws its own frame, so nothing moves', () => {
    expect(windowButtonsMoveOn('linux')).toBe(false);
    expect(windowButtonsMoveOn('win32')).toBe(false);
  });
});

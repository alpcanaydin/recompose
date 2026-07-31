import { describe, expect, test } from 'vitest';

import { windowButtonsFor } from './window-buttons';

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

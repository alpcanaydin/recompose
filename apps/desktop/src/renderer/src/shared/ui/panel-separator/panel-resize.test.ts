import { expect, test } from 'vitest';

import { draggedPanel, panelBounds, steppedPanel } from './panel-resize';

const bounds = panelBounds.inspector;

test('a width inside the bounds is taken as it stands', () => {
  expect(draggedPanel(340, bounds)).toEqual({ standing: 'sized', width: 340 });
});

test('a drag beyond the widest the panel may stand stops at that width', () => {
  expect(draggedPanel(2000, bounds)).toEqual({ standing: 'sized', width: bounds.max });
});

test('a drag under the narrowest width holds there rather than shrinking further', () => {
  expect(draggedPanel(bounds.min - 8, bounds)).toEqual({ standing: 'sized', width: bounds.min });
});

test('a drag well past the narrowest width collapses the panel instead', () => {
  expect(draggedPanel(bounds.min - bounds.collapseBelow, bounds)).toEqual({
    standing: 'collapsed',
  });
});

test('a drag to nothing collapses, because a person dragged it shut', () => {
  expect(draggedPanel(0, bounds)).toEqual({ standing: 'collapsed' });
});

test('a step widens the panel by one step, and never past the widest', () => {
  expect(steppedPanel(340, 1, bounds)).toBe(340 + bounds.step);
  expect(steppedPanel(bounds.max, 1, bounds)).toBe(bounds.max);
});

test('a step narrows the panel by one step, and never under the narrowest', () => {
  expect(steppedPanel(340, -1, bounds)).toBe(340 - bounds.step);
  expect(steppedPanel(bounds.min, -1, bounds)).toBe(bounds.min);
});

test('the sidebar and the inspector each carry their own bounds', () => {
  expect(panelBounds.sidebar.min).toBeLessThan(panelBounds.sidebar.max);
  expect(panelBounds.inspector.min).toBeLessThan(panelBounds.inspector.max);
});

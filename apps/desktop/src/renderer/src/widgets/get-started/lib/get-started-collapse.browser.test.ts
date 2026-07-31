import { beforeEach, expect, test } from 'vitest';

import { collapseGetStarted, expandGetStarted, getStartedCollapsed } from './get-started-collapse';

beforeEach(() => {
  localStorage.clear();
});

test('a checklist nobody has touched stands open', () => {
  expect(getStartedCollapsed()).toBe(false);
});

test('a checklist folded away stays folded on the next session', () => {
  collapseGetStarted();

  expect(getStartedCollapsed()).toBe(true);
});

test('opening the checklist again undoes the fold for good', () => {
  collapseGetStarted();
  expandGetStarted();

  expect(getStartedCollapsed()).toBe(false);
});

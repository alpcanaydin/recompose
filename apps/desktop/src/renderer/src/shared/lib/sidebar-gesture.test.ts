import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { sidebarGestureFrom, TRAVEL_TO_FLIP } from './sidebar-gesture';

describe('what a drag along the sidebar edge asks for', () => {
  test('travel towards the sidebar asks for it to go', () => {
    expect(sidebarGestureFrom(-TRAVEL_TO_FLIP)).toBe('hidden');
  });

  test('travel out from the sidebar asks for it back', () => {
    expect(sidebarGestureFrom(TRAVEL_TO_FLIP)).toBe('shown');
  });

  test('one pixel short of the threshold asks for nothing, in either direction', () => {
    expect(sidebarGestureFrom(-(TRAVEL_TO_FLIP - 1))).toBe('unchanged');
    expect(sidebarGestureFrom(TRAVEL_TO_FLIP - 1)).toBe('unchanged');
  });

  test('a press that never moves asks for nothing', () => {
    expect(sidebarGestureFrom(0)).toBe('unchanged');
  });

  test.prop([fc.integer({ min: -TRAVEL_TO_FLIP + 1, max: TRAVEL_TO_FLIP - 1 })])(
    'any travel shorter than the threshold asks for nothing',
    (travel) => {
      expect(sidebarGestureFrom(travel)).toBe('unchanged');
    },
  );

  test.prop([fc.integer({ min: TRAVEL_TO_FLIP, max: 4000 })])(
    'any travel far enough asks along the way it went',
    (travel) => {
      expect(sidebarGestureFrom(travel)).toBe('shown');
      expect(sidebarGestureFrom(-travel)).toBe('hidden');
    },
  );
});

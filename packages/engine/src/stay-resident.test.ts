import { afterEach, describe, expect, test, vi } from 'vitest';

import { stayResident } from './stay-resident';

function heldHandles(): number {
  return process.getActiveResourcesInfo().filter((held) => held === 'Timeout').length;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the engine child between directives', () => {
  test('it holds the loop open, so a child with no listener still waits for the next directive', () => {
    const before = heldHandles();
    const residency = stayResident();

    try {
      expect(heldHandles()).toBe(before + 1);
    } finally {
      residency.release();
    }
  });

  test('releasing gives the loop back, so nothing outlives a child the host has finished with', () => {
    const before = heldHandles();
    const residency = stayResident();

    residency.release();

    expect(heldHandles()).toBe(before);
  });

  test('the hold outlives its own period, so a child stays past the first tick rather than leaving', () => {
    vi.useFakeTimers();

    const residency = stayResident();

    try {
      vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 3);

      expect(vi.getTimerCount()).toBe(1);
    } finally {
      residency.release();
    }
  });
});

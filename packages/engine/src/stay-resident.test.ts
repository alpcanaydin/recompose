import { describe, expect, test } from 'vitest';

import { stayResident } from './stay-resident';

function heldHandles(): number {
  return process.getActiveResourcesInfo().filter((held) => held === 'Timeout').length;
}

describe('the engine child between directives', () => {
  test('it holds the loop open, so a child with no listener still waits for the next directive', () => {
    const before = heldHandles();
    const residency = stayResident();

    expect(heldHandles()).toBe(before + 1);

    residency.release();
  });

  test('releasing gives the loop back, so nothing outlives a child the host has finished with', () => {
    const before = heldHandles();
    const residency = stayResident();

    residency.release();

    expect(heldHandles()).toBe(before);
  });
});

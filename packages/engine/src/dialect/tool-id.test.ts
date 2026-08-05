import { describe, expect, it } from 'vitest';

import { firstToolIdCollision, sanitizeToolId } from './tool-id';

describe('sanitizeToolId: a tool-call id crosses safely to a strict target', () => {
  it('rewrites spaces, dots, and colons to underscores', () => {
    expect(sanitizeToolId('call.with space:1')).toBe('call_with_space_1');
  });

  it('leaves an already-safe id untouched', () => {
    expect(sanitizeToolId('call_weather-1')).toBe('call_weather-1');
  });

  it('rewrites every unsafe run character by character', () => {
    expect(sanitizeToolId('a/b\\c#d')).toBe('a_b_c_d');
  });
});

describe('firstToolIdCollision: distinct ids that sanitize alike are ambiguous', () => {
  it('names the shared sanitized id when two distinct ids collide', () => {
    expect(firstToolIdCollision(['a.1', 'a:1'])).toBe('a_1');
  });

  it('reports no collision when the same id repeats or all ids stay distinct', () => {
    expect(firstToolIdCollision(['call_a', 'call_a', 'call_b'])).toBeUndefined();
    expect(firstToolIdCollision(['a.1', 'b.1'])).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { sanitizeToolId } from './tool-id';

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

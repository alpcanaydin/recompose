import { describe, expect, it } from 'vitest';

import { cloneModelMetadata } from './model-metadata';

describe('cloning provider model metadata', () => {
  it('should copy the override headers rather than share them', () => {
    const original = {
      id: 'grok-5',
      provider: 'xai',
      headers: { 'x-grok-mode': 'fast' },
    };

    const clone = cloneModelMetadata(original);

    expect(clone.headers).toEqual({ 'x-grok-mode': 'fast' });
    expect(clone.headers).not.toBe(original.headers);
  });
});

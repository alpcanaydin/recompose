import { describe, expect, it } from 'vitest';

import { normalizeModelThinking } from './model-config';

describe('normalizeModelThinking: the levels a maintainer typed by hand', () => {
  it('drops a blank level, lowercases the rest, and keeps the first spelling of each', () => {
    const thinking = normalizeModelThinking({ levels: ['   ', 'High', 'high', 'none'] });

    expect(thinking.levels).toEqual(['high', 'none']);
    expect(thinking.zeroAllowed).toBe(true);
  });
});

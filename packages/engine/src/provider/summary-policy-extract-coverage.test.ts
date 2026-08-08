import { describe, expect, it } from 'vitest';

import { extractSummaryConfig } from './summary-policy-extract';

describe('extracting the reasoning summary a caller asked for', () => {
  it('should read no preference from a summary written as blank space', () => {
    const config = extractSummaryConfig({ reasoning: { summary: '   ' } }, 'responses');

    expect(config).toEqual({ mode: 'unspecified' });
  });

  it('should read no preference from Claude thinking that names no display', () => {
    const config = extractSummaryConfig({ thinking: { type: 'adaptive' } }, 'anthropic');

    expect(config).toEqual({ mode: 'unspecified' });
  });
});

import { describe, expect, it } from 'vitest';

import { cleanAntigravityRequestSchemas } from './antigravity-request-schemas';

describe('cleanAntigravityRequestSchemas: a tool list with entries it cannot read', () => {
  it('cleans the real declaration and steps over the entries that are not records', () => {
    const request = {
      tools: [
        'not a tool',
        {
          functionDeclarations: [
            null,
            { name: 'Bash', parameters: { type: 'object', properties: {} } },
          ],
        },
      ],
    };

    cleanAntigravityRequestSchemas(request, 'gemini-3-pro');

    expect(request).toHaveProperty('tools.1.functionDeclarations.1.parameters.type', 'object');
    expect(request).toHaveProperty('tools.0', 'not a tool');
  });
});

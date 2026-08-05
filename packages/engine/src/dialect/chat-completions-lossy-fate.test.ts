import { describe, expect, it } from 'vitest';

import { encodeResponse } from './chat-completions-codec';
import { aHubResponse } from './hub.testkit';

describe('encodeResponse names the destination of a lossy stop-reason mapping', () => {
  it('records the refusal stop reason as a lossy mapping onto the chat finish reason', () => {
    const result = encodeResponse(aHubResponse({ stopReason: 'refusal' }));

    if ('refusal' in result) {
      throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
    }

    expect(result.fates).toContainEqual({
      field: 'stopReason',
      disposition: 'mapped',
      to: 'finish_reason (lossy)',
    });
  });
});

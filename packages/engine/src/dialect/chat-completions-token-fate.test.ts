import { describe, expect, it } from 'vitest';

import { decodeRequest } from './chat-completions-request';
import { aChatRequest } from './chat-completions.testkit';

function translated(request: Parameters<typeof decodeRequest>[0]) {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result;
}

describe('decodeRequest records the discarded token ceiling honestly', () => {
  it('marks max_tokens dropped when max_completion_tokens wins', () => {
    const { fates } = translated(aChatRequest({ max_completion_tokens: 100, max_tokens: 50 }));

    expect(fates).toContainEqual({
      field: 'max_completion_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens',
    });
    expect(fates).toContainEqual({ field: 'max_tokens', disposition: 'mapped', to: 'absent' });
  });
});

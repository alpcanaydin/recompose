import { describe, expect, it } from 'vitest';

import type { Crossing, JsonObject } from './gateway-wire';

import { outboundBodyFor } from './gateway-outbound-body';

function aCrossing(dialect: Crossing['dialect'], raw: JsonObject): Crossing {
  return {
    dialect,
    raw,
    gatewayName: 'sample',
    virtualModel: 'fast',
    providerModel: 'provider-model',
  };
}

describe('the body a crossing carries upstream', () => {
  it('should refuse a conversation that folds away empty in translation', () => {
    const crossing = aCrossing('anthropic', { model: 'fast', max_tokens: 16, messages: [] });

    expect(outboundBodyFor(crossing, 'chat-completions')).toEqual({
      refusal: { reason: 'empty-conversation' },
    });
  });

  it('should refuse a request that does not speak its own declared dialect', () => {
    const crossing = aCrossing('anthropic', { model: 'fast', prompt: 'hello' });

    expect(outboundBodyFor(crossing, 'chat-completions')).toEqual({
      refusal: { reason: 'empty-conversation' },
    });
  });

  it('should name the provider model on a translated body', () => {
    const crossing = aCrossing('anthropic', {
      model: 'fast',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(outboundBodyFor(crossing, 'chat-completions')).toHaveProperty(
      'body.model',
      'provider-model',
    );
  });

  it('should carry a Responses ask to a Responses target untranslated', () => {
    const crossing = aCrossing('responses', { model: 'fast', input: 'hello' });
    const outbound = outboundBodyFor(crossing, 'responses');

    expect(outbound).toHaveProperty('body.input', 'hello');
    expect(outbound).toHaveProperty('body.model', 'provider-model');
  });
});

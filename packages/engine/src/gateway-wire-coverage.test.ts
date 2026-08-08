import { describe, expect, test } from 'vitest';

import { ingressPayload, streamAsk, virtualNameOf } from './gateway-wire';

describe('reading an interactions request the gateway may serve', () => {
  test('a turn given as a single object counts as input', () => {
    const body = { model: 'fast', input: { role: 'user', content: 'hello' } };

    expect(ingressPayload('interactions', body)).toBe(body);
  });

  test('a turn given as a list counts as input', () => {
    const body = { agent: 'planner', input: [{ role: 'user', content: 'hello' }] };

    expect(ingressPayload('interactions', body)).toBe(body);
  });

  test('a request naming both a model and an agent is refused', () => {
    expect(
      ingressPayload('interactions', { model: 'fast', agent: 'planner', input: 'hi' }),
    ).toBeNull();
  });

  test('a request naming neither a model nor an agent is refused', () => {
    expect(ingressPayload('interactions', { input: 'hi' })).toBeNull();
  });

  test('a request whose stream flag is not a boolean is refused', () => {
    expect(
      ingressPayload('interactions', { model: 'fast', input: 'hi', stream: 'yes' }),
    ).toBeNull();
  });
});

describe('naming the virtual model a request asks for', () => {
  test('the model field names it', () => {
    expect(virtualNameOf({ model: 'fast' })).toBe('fast');
  });

  test('an interactions request may name an agent instead', () => {
    expect(virtualNameOf({ agent: 'planner' }, 'interactions')).toBe('planner');
  });

  test('an agent named outside the interactions dialect names nothing', () => {
    expect(virtualNameOf({ agent: 'planner' }, 'responses')).toBe('');
  });
});

describe('carrying the streaming ask to the provider', () => {
  test('a streaming request asks for a stream', () => {
    expect(streamAsk({ stream: true })).toEqual({ stream: true });
  });

  test('a non-streaming request asks for nothing', () => {
    expect(streamAsk({ stream: false })).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';

import type { Crossing } from '../gateway-wire';

import {
  geminiInteractionsBody,
  parseGeminiInteractionsCredential,
} from './gemini-interactions-policy';

function crossing(): Crossing {
  return {
    dialect: 'anthropic',
    raw: {},
    gatewayName: 'Codex',
    virtualModel: 'fast',
    providerModel: 'gemini-3-pro',
  };
}

describe('reading a Gemini Interactions credential', () => {
  it('should treat a JSON document that names no key as the key itself', () => {
    const raw = JSON.stringify({ note: 'no key here' });

    const credential = parseGeminiInteractionsCredential(raw);

    expect(credential).toEqual({ apiKey: raw, payload: { defaults: [], overrides: [] } });
  });

  it('should hold no payload rules when the payload is not a document', () => {
    const credential = parseGeminiInteractionsCredential(
      JSON.stringify({ api_key: 'k-1', payload: 'nothing structured' }),
    );

    expect(credential.payload).toEqual({ defaults: [], overrides: [] });
  });

  it('should drop a payload rule that names no models or params', () => {
    const credential = parseGeminiInteractionsCredential(
      JSON.stringify({
        api_key: 'k-1',
        payload: {
          defaults: [
            { models: ['anything'] },
            'not a rule',
            { models: [], params: { temperature: 0 } },
          ],
        },
      }),
    );

    expect(credential.payload.defaults).toEqual([{ models: [], params: { temperature: 0 } }]);
  });
});

describe('applying a Gemini Interactions payload rule', () => {
  it('should never match a model entry written as a bare name', () => {
    const credential = parseGeminiInteractionsCredential(
      JSON.stringify({
        api_key: 'k-1',
        payload: { overrides: [{ models: ['gemini-3-pro'], params: { temperature: 0.1 } }] },
      }),
    );

    const body = geminiInteractionsBody(crossing(), { model: 'gemini-3-pro' }, credential);

    expect(body).not.toHaveProperty('temperature');
  });
});

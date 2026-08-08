import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { Crossing, JsonObject } from '../gateway-wire';

import {
  credentialedRequestBody,
  credentialedRequestHeaders,
  credentialedRequestUrl,
} from './credentialed-target';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;

function crossingFor(providerModel: string, overrides: Partial<Crossing> = {}): Crossing {
  return {
    dialect: 'chat-completions',
    raw: {},
    gatewayName: 'codex',
    virtualModel: 'fast',
    providerModel,
    ...overrides,
  };
}

function grantFor(
  provider: string,
  credential: string,
  origin = 'https://example.test',
): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: origin,
    spend: { custody: 'credentialed', provider, credential },
  };
}

describe('an xAI request that asks the gateway to inject search', () => {
  it('records which tools the caller owns', () => {
    const crossing = crossingFor('grok-4', { xaiInjectSearch: true });
    const body: JsonObject = {
      messages: [{ role: 'user', content: 'find it' }],
      tools: [{ type: 'function', name: 'lookup' }],
    };

    credentialedRequestBody(grantFor('xai', 'xai-key'), crossing, body);

    expect(crossing.xaiSearchOwnership?.clientTools).toHaveLength(1);
    expect(crossing.xaiSearchOwnership?.clientTools[0]).toContain('lookup');
  });

  it('records no ownership when the gateway injects nothing', () => {
    const crossing = crossingFor('grok-4');

    credentialedRequestBody(grantFor('xai', 'xai-key'), crossing, { messages: [] });

    expect(crossing.xaiSearchOwnership).toBeUndefined();
  });
});

describe('an AI Studio request whose generation config is not an object', () => {
  it('leaves the unreadable config where it found it', () => {
    const prepared = credentialedRequestBody(
      grantFor('aistudio', 'studio-key'),
      crossingFor('gemini-3-pro'),
      { generationConfig: 'fast', contents: [] },
    );

    expect(prepared).toHaveProperty('generationConfig', 'fast');
  });
});

const tokenlessVertex = JSON.stringify({ project_id: 'demo', location: 'us-central1' });

describe('a Vertex account whose credential names no key or token', () => {
  it('falls back to the plain chat completions path', () => {
    const url = credentialedRequestUrl(
      grantFor('vertex', tokenlessVertex),
      crossingFor('gemini-3-pro'),
    );

    expect(url).toBe('https://example.test/v1/chat/completions');
  });

  it('sends no Vertex headers it could not build', () => {
    const headers = credentialedRequestHeaders(
      grantFor('vertex', tokenlessVertex).spend,
      crossingFor('gemini-3-pro'),
    );

    expect(headers).toEqual({ 'content-type': 'application/json' });
  });
});

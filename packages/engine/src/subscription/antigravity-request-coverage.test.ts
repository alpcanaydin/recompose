import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { antigravityCountTokensRequest, antigravityProviderRequest } from './antigravity-request';

const credential = {
  accessToken: 'google-access',
  refreshToken: 'google-refresh',
  projectId: 'cloud-project',
};

function envelopeOf(body: JsonObject): JsonObject {
  const parsed = parsedJson(
    antigravityProviderRequest(
      'https://daily-cloudcode-pa.googleapis.com',
      body,
      credential,
      { requestId: 'request-uuid', sessionId: 'session-1' },
      1_700_000_000_000,
    ).body,
  );

  if (!isJsonObject(parsed)) throw new Error('expected an Antigravity envelope');

  return parsed;
}

function countedRequestOf(body: JsonObject): JsonObject {
  const parsed = parsedJson(
    antigravityCountTokensRequest('https://daily-cloudcode-pa.googleapis.com', body, credential)
      .body,
  );

  if (!isJsonObject(parsed) || !isJsonObject(parsed['request'])) {
    throw new Error('expected a nested Antigravity request');
  }

  return parsed['request'];
}

const thinkingClaude = 'claude-sonnet-4-5-thinking';

function thinkingBody(overrides: JsonObject): JsonObject {
  return {
    model: thinkingClaude,
    generationConfig: { thinkingConfig: { includeThoughts: true } },
    tools: [{ functionDeclarations: [{ name: 'Bash' }] }],
    ...overrides,
  };
}

describe('an Antigravity body that names no model', () => {
  it('builds the envelope around an empty model name', () => {
    const envelope = envelopeOf({ contents: [], generationConfig: { maxOutputTokens: 99 } });

    expect(envelope).toHaveProperty('model', '');
    expect(envelope).toHaveProperty('requestType', 'agent');
    expect(envelope).not.toHaveProperty('request.generationConfig.maxOutputTokens');
  });
});

describe('an Antigravity thinking hint joining a system instruction', () => {
  it('replaces parts that are not a list with the hint alone', () => {
    const request = countedRequestOf(
      thinkingBody({ systemInstruction: { role: 'user', parts: 'be brief' } }),
    );

    expect(request).toHaveProperty('systemInstruction.parts.0.text');
    expect(JSON.stringify(request)).toContain('Interleaved thinking is enabled');
    expect(request).not.toHaveProperty('systemInstruction.parts.1');
  });
});

describe('an Antigravity tool list the hint rule cannot read', () => {
  it('adds no hint when a tool is not an object', () => {
    const request = countedRequestOf(thinkingBody({ tools: ['Bash'] }));

    expect(JSON.stringify(request)).not.toContain('Interleaved thinking is enabled');
  });

  it('adds the hint for declarations spelled in snake case', () => {
    const request = countedRequestOf(
      thinkingBody({ tools: [{ function_declarations: [{ name: 'Bash' }] }] }),
    );

    expect(JSON.stringify(request)).toContain('Interleaved thinking is enabled');
  });
});

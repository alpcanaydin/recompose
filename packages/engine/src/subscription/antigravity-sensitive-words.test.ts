import { describe, expect, test } from 'vitest';

import { parsedJson } from '../gateway-wire';
import { antigravityCountTokensRequest, antigravityProviderRequest } from './antigravity-request';

const credential = { accessToken: 'access', projectId: 'project' };
const body = {
  model: 'gemini-3.6-flash-high',
  systemInstruction: {
    role: 'user',
    parts: [{ text: 'You are Hermes, created by Nous Research. Use PROXY safely.' }],
  },
  contents: [{ role: 'user', parts: [{ text: 'Hermes proxy remains unchanged here.' }] }],
};

function inferenceBody() {
  const request = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    body,
    credential,
    { requestId: 'request-1', sessionId: 'session-1' },
    1,
    ['Hermes', 'Nous Research', 'proxy'],
  );

  return parsedJson(request.body);
}

describe('Antigravity sensitive-word obfuscation', () => {
  test('changes only system instruction text and preserves matched casing', () => {
    const sent = inferenceBody();

    expect(sent).toHaveProperty(
      'request.systemInstruction.parts.0.text',
      'You are H\u200Bermes, created by N\u200Bous Research. Use P\u200BROXY safely.',
    );
    expect(sent).toHaveProperty(
      'request.contents.0.parts.0.text',
      'Hermes proxy remains unchanged here.',
    );
  });

  test('applies the same policy to countTokens', () => {
    const request = antigravityCountTokensRequest(
      'https://daily-cloudcode-pa.googleapis.com',
      body,
      credential,
      ['Hermes', 'Nous Research'],
    );

    expect(parsedJson(request.body)).toHaveProperty(
      'request.systemInstruction.parts.0.text',
      'You are H\u200Bermes, created by N\u200Bous Research. Use PROXY safely.',
    );
  });
});

describe('Antigravity sensitive-word obfuscation on an instruction with no text', () => {
  test('leaves an instruction with no parts and a part with no text alone', () => {
    const request = antigravityCountTokensRequest(
      'https://daily-cloudcode-pa.googleapis.com',
      {
        model: 'gemini-3.6-flash-high',
        systemInstruction: { role: 'user' },
        system_instruction: { role: 'user', parts: ['proxy', { inlineData: { data: 'proxy' } }] },
        contents: [],
      },
      credential,
      ['proxy'],
    );

    expect(parsedJson(request.body)).toHaveProperty('request.system_instruction.parts.0', 'proxy');
  });
});

describe('Antigravity sensitive-word obfuscation on a snake-case instruction', () => {
  test('supports the snake-case string spelling and ignores unusable words', () => {
    const request = antigravityCountTokensRequest(
      'https://daily-cloudcode-pa.googleapis.com',
      {
        model: 'gemini-3.6-flash-high',
        system_instruction: 'Use proxy safely',
        contents: [],
      },
      credential,
      ['', 'p', 'p\u200Broxy', 'proxy'],
    );

    expect(parsedJson(request.body)).toHaveProperty(
      'request.system_instruction',
      'Use p\u200Broxy safely',
    );
  });
});

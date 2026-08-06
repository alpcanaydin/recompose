import { describe, expect, test } from 'vitest';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { antigravityCountTokensRequest, antigravityProviderRequest } from './antigravity-request';

const credential = {
  accessToken: 'google-access',
  refreshToken: 'google-refresh',
  projectId: 'cloud-project',
};

function bodyOf(body: Record<string, unknown>, sessionId = '-123456789') {
  const request = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com/',
    body,
    credential,
    { requestId: 'request-uuid', sessionId },
    1_700_000_000_000,
  );

  const parsed = parsedJson(request.body);

  if (!isJsonObject(parsed)) {
    throw new Error('expected an Antigravity request object');
  }

  return { request, body: parsed };
}

describe('building the CLIProxyAPI-compatible Antigravity envelope', () => {
  test('wraps Gemini payloads with route model, project, identity, and session', () => {
    const { request, body } = bodyOf({
      model: 'gemini-3-flash-agent',
      stream: true,
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      safetySettings: [{ category: 'unsafe' }],
      generationConfig: { maxOutputTokens: 128, temperature: 0.4 },
    });

    expect(request.url).toBe(
      'https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
    );
    expect(request.headers).toEqual([
      ['Content-Type', 'application/json'],
      ['Authorization', 'Bearer google-access'],
      ['User-Agent', 'antigravity/hub'],
      ['Connection', 'close'],
    ]);
    expect(body).toMatchObject({
      model: 'gemini-3-flash-agent',
      userAgent: 'antigravity',
      requestType: 'agent',
      project: 'cloud-project',
      requestId: 'agent-request-uuid',
      request: {
        sessionId: '-123456789',
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        generationConfig: { temperature: 0.4 },
      },
    });
    expect(body).not.toHaveProperty('request.safetySettings');
  });
});

describe('applying Antigravity model-specific request rules', () => {
  test('Claude models force validated tool calling without dropping caller fields', () => {
    const { body } = bodyOf({
      model: 'claude-sonnet-4-6',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      generationConfig: { maxOutputTokens: 128 },
      toolConfig: { functionCallingConfig: { allowedFunctionNames: ['search'] } },
    });

    expect(body).toMatchObject({
      request: {
        generationConfig: { maxOutputTokens: 128 },
        toolConfig: {
          functionCallingConfig: {
            mode: 'VALIDATED',
            allowedFunctionNames: ['search'],
          },
        },
      },
    });
  });

  test('image and independent web-search request identities match upstream rules', () => {
    const image = bodyOf({ model: 'gemini-3.1-flash-image', contents: [] }).body;
    const search = bodyOf({
      model: 'gemini-3.1-flash-lite',
      requestType: 'web_search',
      contents: [],
    }).body;

    expect(image).toMatchObject({
      requestType: 'image_gen',
      requestId: 'image_gen/1700000000000/request-uuid/12',
    });
    expect(search).toMatchObject({ requestType: 'web_search' });
    expect(search).not.toHaveProperty('request.sessionId');
  });
});

test('native countTokens strips routing fields and keeps Gemini contents', () => {
  const request = antigravityCountTokensRequest(
    'https://daily-cloudcode-pa.googleapis.com/',
    {
      model: 'gemini-3-flash',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      safetySettings: [],
    },
    credential,
  );

  expect(request.url).toBe('https://daily-cloudcode-pa.googleapis.com/v1internal:countTokens');
  expect(JSON.parse(request.body)).toEqual({
    contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
  });
});

describe('sanitizing only schema-bearing Antigravity request fields', () => {
  test('renames and cleans Claude parametersJsonSchema', () => {
    const { body } = bodyOf({
      model: 'claude-sonnet-4-6',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'search',
              parametersJsonSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', format: 'uri', 'x-extra': true },
                },
              },
            },
          ],
        },
      ],
    });

    expect(body).not.toHaveProperty('request.tools.0.functionDeclarations.0.parametersJsonSchema');
    expect(body).toHaveProperty(
      'request.tools.0.functionDeclarations.0.parameters.properties.query.description',
      'format: uri',
    );
    expect(body).not.toHaveProperty(
      'request.tools.0.functionDeclarations.0.parameters.properties.query.x-extra',
    );
  });
});

describe('protecting non-schema Antigravity payload data', () => {
  test('does not mutate schema-like keys inside function-call history', () => {
    const history = {
      default: 'keep-default',
      format: 'keep-format',
      title: 'keep-title',
      const: 'keep-const',
    };
    const { body } = bodyOf({
      model: 'claude-sonnet-4-6',
      contents: [{ role: 'model', parts: [{ functionCall: { name: 'tool', args: history } }] }],
      tools: [{ functionDeclarations: [{ name: 'tool', parameters: { type: 'object' } }] }],
    });

    expect(body).toHaveProperty('request.contents.0.parts.0.functionCall.args', history);
  });

  test('cleans structured-output schemas without adding tool placeholders', () => {
    const { body } = bodyOf({
      model: 'gemini-3-flash',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      generationConfig: {
        responseJsonSchema: {
          type: 'object',
          properties: { result: { type: 'string', format: 'email' } },
        },
      },
    });

    expect(body).not.toHaveProperty(
      'request.generationConfig.responseJsonSchema.properties.result.format',
    );
    expect(body).not.toHaveProperty(
      'request.generationConfig.responseJsonSchema.properties.reason',
    );
  });
});

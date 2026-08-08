import { describe, expect, it } from 'vitest';

import { geminiPayload } from '../gateway-gemini-ingress';
import { isJsonObject } from '../gateway-wire';
import { antigravityProviderRequest } from '../subscription/antigravity-request';

describe('Gemini Claude signatures crossing Antigravity', () => {
  it('should normalize a strict Claude thought signature to double-layer form', () => {
    const native = strictClaudeSignature();
    const request = prepared(
      {
        contents: [
          {
            role: 'model',
            parts: [
              { text: 'internal reasoning', thought: true, thoughtSignature: native },
              { text: 'visible answer' },
            ],
          },
        ],
      },
      'claude-opus-4-6-thinking',
    );

    expect(request).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      Buffer.from(native).toString('base64'),
    );
  });

  it('should drop a loose E-prefix thought while retaining visible text', () => {
    const loose = Buffer.from([0x12, 0x01, 0x02]).toString('base64');
    const request = prepared(
      {
        contents: [
          {
            role: 'model',
            parts: [
              { text: 'drop me', thought: true, thoughtSignature: loose },
              { text: 'visible answer' },
            ],
          },
        ],
      },
      'claude-opus-4-6-thinking',
    );

    expect(request).toHaveProperty('contents.0.parts', [{ text: 'visible answer' }]);
  });
});

describe('Gemini Claude signature cleanup crossing Antigravity', () => {
  it('should drop empty thought text and strip function-call signatures for Claude models', () => {
    const request = prepared(
      {
        contents: [
          {
            role: 'model',
            parts: [
              { text: '', thought: true, thoughtSignature: strictClaudeSignature() },
              {
                functionCall: { name: 'tool', args: {} },
                thoughtSignature: 'skip_thought_signature_validator',
              },
            ],
          },
        ],
      },
      'Claude-Opus-4-6-Thinking',
    );

    expect(request).toHaveProperty('contents.0.parts.0.functionCall.name', 'tool');
    expect(request).not.toHaveProperty('contents.0.parts.0.thoughtSignature');
  });
});

describe('Gemini function history crossing Antigravity', () => {
  it('should add the bypass only to the first parallel unsigned call', () => {
    const request = prepared({
      contents: [
        {
          role: 'model',
          parts: [
            { functionCall: { name: 'one', args: {} } },
            { functionCall: { name: 'two', args: {} } },
          ],
        },
      ],
    });

    expect(request).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
    expect(request).not.toHaveProperty('contents.0.parts.1.thoughtSignature');
  });
});

describe('Gemini function response repair crossing Antigravity', () => {
  it('should repair response names and order parallel responses FIFO', () => {
    const request = prepared({
      contents: [
        {
          role: 'model',
          parts: [
            { functionCall: { id: 'one', name: 'first', args: {} } },
            { functionCall: { id: 'two', name: 'second', args: {} } },
          ],
        },
        {
          role: 'user',
          parts: [
            { functionResponse: { id: 'two', name: '', response: {} } },
            { functionResponse: { id: 'one', name: 'unknown', response: {} } },
          ],
        },
      ],
    });

    expect(request).toHaveProperty('contents.1.role', 'model');
    expect(request).toHaveProperty('contents.1.parts.0.functionResponse', {
      id: 'one',
      name: 'first',
      response: {},
    });
    expect(request).toHaveProperty('contents.1.parts.1.functionResponse', {
      id: 'two',
      name: 'second',
      response: {},
    });
  });
});

describe('Snake-case Gemini references crossing Antigravity', () => {
  it('should canonicalize calls, responses, declarations, and allowed names', () => {
    const payload = geminiPayload({
      contents: [
        { role: 'model', parts: [{ function_call: { name: 'read_file', args: {} } }] },
        { role: 'user', parts: [{ function_response: { name: 'read_file', response: {} } }] },
      ],
      tools: [{ function_declarations: [{ name: 'read/file' }, { name: 'read_file' }] }],
      tool_config: {
        function_calling_config: { mode: 'ANY', allowed_function_names: ['read_file'] },
      },
    });

    if (payload === null) throw new Error('expected Gemini payload');

    const request = prepared(payload);
    const mapped = request['tools'];

    expect(mapped).toHaveProperty('0.functionDeclarations.length', 2);
    expect(request).toHaveProperty('contents.0.parts.0.functionCall.name');
    expect(request).toHaveProperty('contents.1.parts.0.functionResponse.name');
    expect(request).toHaveProperty('toolConfig.functionCallingConfig.allowedFunctionNames.0');
  });
});

function prepared(
  body: Record<string, unknown>,
  model = 'gemini-3-flash',
): Record<string, unknown> {
  const provider = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    { ...body, model },
    { accessToken: 'token', projectId: 'project' },
    { requestId: 'request-1', sessionId: 'session-1' },
    0,
  );
  const envelope: unknown = JSON.parse(provider.body);

  if (!isJsonObject(envelope) || !isJsonObject(envelope['request'])) {
    throw new Error('expected Antigravity request');
  }

  return envelope['request'];
}

function strictClaudeSignature(): string {
  const channel = Buffer.from([0x08, 0x0c, 0x10, 0x02]);
  const container = Buffer.concat([Buffer.from([0x0a, channel.length]), channel]);

  return Buffer.concat([Buffer.from([0x12, container.length]), container]).toString('base64');
}

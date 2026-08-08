import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest, ChatStreamFrame } from './chat-completions-wire';
import type { GeminiResponse } from './gemini-wire';

import { isJsonObject } from '../gateway-wire';
import { antigravityProviderRequest } from '../subscription/antigravity-request';
import {
  translateRequestToGemini,
  translateResponseFromGemini,
  translateStreamFromGemini,
} from './gemini-bridge';

describe('Chat reasoning crossing Antigravity Claude', () => {
  it('should drop unsigned reasoning but preserve visible assistant text', () => {
    const request = prepared(
      {
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', reasoning_content: 'unsigned', content: 'visible text' },
          { role: 'user', content: 'continue' },
        ],
      },
      'claude-sonnet-4-6',
    );

    expect(request).toHaveProperty('contents.1.parts', [{ text: 'visible text' }]);
  });

  it('should drop an assistant turn made empty by reasoning sanitation', () => {
    const request = prepared(
      {
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', reasoning_content: 'unsigned', content: '' },
          { role: 'user', content: 'continue' },
        ],
      },
      'claude-sonnet-4-6',
    );

    expect(request).toHaveProperty('contents', [
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'user', parts: [{ text: 'continue' }] },
    ]);
  });
});

describe('Chat thinking aliases crossing Antigravity', () => {
  it.each([
    [{ reasoning_effort: 'high' }, true],
    [{ reasoning: { exclude: false } }, true],
    [{ reasoning: { exclude: true } }, false],
    [
      {
        reasoning_effort: 'high',
        extra_body: { google: { thinking_config: { include_thoughts: false } } },
      },
      false,
    ],
  ])('should normalize thinking intent for %j', (fields, expected) => {
    const request = prepared({ messages: [{ role: 'user', content: 'hi' }], ...fields });

    expect(request).toHaveProperty('generationConfig.thinkingConfig.includeThoughts', expected);
  });

  it('should ignore a string includeThoughts alias', () => {
    const request = prepared({
      messages: [{ role: 'user', content: 'hi' }],
      generationConfig: { thinkingConfig: { includeThoughts: 'true' } },
    });

    expect(request).not.toHaveProperty('generationConfig.thinkingConfig.includeThoughts');
  });
});

describe('Chat tools crossing Antigravity', () => {
  it('should deduplicate declarations and consistently map colliding long names', () => {
    const first = 'mcp__plugin_cloudflare_cloudflare-builds__workers_builds_get_build';
    const second = 'mcp__plugin_cloudflare_cloudflare-builds__workers_builds_get_build_logs';
    const request = prepared({
      messages: [
        {
          role: 'assistant',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: second, arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_1', content: '{}' },
      ],
      tools: [tool('lookup'), tool('lookup'), tool(first), tool(second)],
      tool_choice: { type: 'function', function: { name: second } },
    });
    const declarations = request['tools'];

    expect(declarations).toHaveProperty('0.functionDeclarations.length', 3);
    expect(request).toHaveProperty('toolConfig.functionCallingConfig.mode', 'ANY');
  });
});

describe('Chat response formats crossing Antigravity', () => {
  it('should remove stale schema aliases and emit one responseSchema', () => {
    const request = prepared({
      messages: [{ role: 'user', content: 'hi' }],
      generationConfig: {
        responseSchema: { type: 'string', description: 'stale' },
        responseJsonSchema: { type: 'string' },
        response_schema: { type: 'string' },
      },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'verdict',
          schema: { type: 'object', properties: { score: { type: 'integer' } } },
        },
      },
    });

    expect(request).toHaveProperty('generationConfig.responseMimeType', 'application/json');
    expect(request).toHaveProperty(
      'generationConfig.responseSchema.properties.score.type',
      'integer',
    );
    expect(request).not.toHaveProperty('generationConfig.responseJsonSchema');
    expect(request).not.toHaveProperty('generationConfig.response_schema');
  });
});

describe('Antigravity responses crossing Chat Completions', () => {
  it('should let tool calls take priority over MAX_TOKENS', async () => {
    const frames = await streamed([
      { candidates: [{ content: { parts: [{ functionCall: { name: 'lookup', args: {} } }] } }] },
      { candidates: [{ finishReason: 'MAX_TOKENS' }] },
    ]);
    const finish = frames
      .flatMap((frame) => (frame.type === 'chunk' ? frame.chunk.choices : []))
      .find((choice) => choice.finish_reason != null);

    expect(finish?.finish_reason).toBe('tool_calls');
  });

  it('should restore reasoning content and disambiguated tool names', () => {
    const translated = translateResponseFromGemini(
      'chat-completions',
      {
        candidates: [
          {
            content: {
              parts: [
                { text: 'reason', thought: true },
                { text: 'answer' },
                { functionCall: { name: 'mapped_name', args: {} } },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, thoughtsTokenCount: 3 },
      },
      { mapped_name: 'original_name' },
    );

    expect(translated).toHaveProperty('value.choices.0.message.reasoning_content', 'reason');
    expect(translated).toHaveProperty(
      'value.choices.0.message.tool_calls.0.function.name',
      'original_name',
    );
  });
});

function prepared(body: ChatCompletionsRequest, model = 'gemini-3-flash'): Record<string, unknown> {
  const translated = translateRequestToGemini('chat-completions', body);

  if ('refusal' in translated) throw new Error('expected Gemini request');

  const provider = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    { ...translated.value, model },
    { accessToken: 'token', projectId: 'project' },
    { requestId: 'request-1', sessionId: 'session-1' },
    0,
  );
  const envelope: unknown = JSON.parse(provider.body);

  if (!isJsonObject(envelope) || !isJsonObject(envelope['request'])) {
    throw new Error('expected Antigravity request envelope');
  }

  return envelope['request'];
}

function tool(name: string): NonNullable<ChatCompletionsRequest['tools']>[number] {
  return { type: 'function', function: { name, parameters: { type: 'object' } } };
}

async function streamed(source: readonly GeminiResponse[]) {
  const frames: ChatStreamFrame[] = [];

  for await (const frame of translateStreamFromGemini('chat-completions', streamOf(source))) {
    frames.push(frame);
  }

  return frames;
}

async function* streamOf<T>(values: readonly T[]): AsyncIterable<T> {
  for (const value of values) {
    await Promise.resolve();
    yield value;
  }
}

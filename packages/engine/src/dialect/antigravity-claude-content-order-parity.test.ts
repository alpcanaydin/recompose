import { describe, expect, it } from 'vitest';

import type { AnthropicContentBlock, AnthropicRequest } from './anthropic-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { antigravityProviderRequest } from '../subscription/antigravity-request';
import { translateRequestToGemini } from './gemini-bridge';

const credential = { accessToken: 'access', projectId: 'project' };

describe('Claude content ordering crossing Antigravity', () => {
  it('TestConvertClaudeRequestToAntigravity_ReorderThinking', () => {
    const parts = providerParts([text('Here is the plan.'), thinking('Planning...')]);

    expect(parts[0]).toHaveProperty('thought', true);
    expect(parts[1]).toHaveProperty('text', 'Here is the plan.');
  });

  it('TestConvertClaudeRequestToAntigravity_ReorderTextAfterFunctionCall', () => {
    const parts = providerParts([
      text('Let me check...'),
      tool('call_abc', 'Read'),
      text('Reading the file now'),
    ]);

    expect(parts.map(partKind)).toEqual(['text', 'text', 'function']);
    expect(parts[1]).toHaveProperty('text', 'Reading the file now');
    expect(parts[2]).toHaveProperty('functionCall.name', 'Read');
  });

  it('TestConvertClaudeRequestToAntigravity_ReorderParallelFunctionCalls', () => {
    const parts = providerParts([
      text('Reading both files.'),
      tool('call_1', 'Read'),
      text('And this one too.'),
      tool('call_2', 'Read'),
    ]);

    expect(parts.map(partKind)).toEqual(['text', 'text', 'function', 'function']);
    expect(parts[2]).toHaveProperty('functionCall.id', 'call_1');
    expect(parts[3]).toHaveProperty('functionCall.id', 'call_2');
  });

  it('TestConvertClaudeRequestToAntigravity_ReorderThinkingAndTextBeforeFunctionCall', () => {
    const parts = providerParts([
      text('Before thinking'),
      thinking('Let me think about this...'),
      tool('call_xyz', 'Bash'),
      text('After tool call'),
    ]);

    expect(parts.map(partKind)).toEqual(['thinking', 'text', 'text', 'function']);
  });
});

function providerParts(content: AnthropicContentBlock[]): Record<string, unknown>[] {
  return assistantParts(providerBody(content));
}

function providerBody(content: AnthropicContentBlock[]): Record<string, unknown> {
  const request: AnthropicRequest = {
    model: 'claude-sonnet-4-5-thinking',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content },
    ],
  };
  const translated = translateRequestToGemini('anthropic', request);

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));

  const provider = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    { ...translated.value, model: request.model },
    credential,
    { requestId: 'request-1', sessionId: 'session-1' },
    1,
  );
  const parsed = parsedJson(provider.body);

  if (!isJsonObject(parsed)) throw new Error('expected provider body');

  return parsed;
}

function assistantParts(body: Record<string, unknown>): Record<string, unknown>[] {
  const envelope = body['request'];

  if (!isJsonObject(envelope) || !Array.isArray(envelope['contents'])) return [];

  const contents: unknown[] = Array.from(envelope['contents']);
  const assistant = contents[1];

  return isJsonObject(assistant) && Array.isArray(assistant['parts'])
    ? assistant['parts'].filter(isJsonObject)
    : [];
}

function text(value: string): AnthropicContentBlock {
  return { type: 'text', text: value };
}

function thinking(value: string): AnthropicContentBlock {
  return { type: 'thinking', thinking: value, signature: strictClaudeSignature() };
}

function tool(id: string, name: string): AnthropicContentBlock {
  return { type: 'tool_use', id, name, input: {} };
}

function strictClaudeSignature(): string {
  const channel = Buffer.from([0x08, 0x0c, 0x10, 0x02]);
  const container = Buffer.concat([Buffer.from([0x0a, channel.length]), channel]);

  return Buffer.concat([Buffer.from([0x12, container.length]), container]).toString('base64');
}

function partKind(part: Record<string, unknown>): string {
  if (part['thought'] === true) return 'thinking';
  if (isJsonObject(part['functionCall'])) return 'function';

  return 'text';
}

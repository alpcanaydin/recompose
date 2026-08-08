import { describe, expect, it } from 'vitest';

import type { AnthropicRequest } from './anthropic-wire';

import { decodeRequestWithCompat } from './anthropic-request-decode';
import { encodeRequestWithCompat } from './chat-completions-request-encode';
import { translateRequest } from './dispatcher';

describe('Claude thinking crossing Chat Completions', () => {
  it('should carry unsigned assistant thinking while dropping redacted and user thinking', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'unsigned' },
            { type: 'redacted_thinking', data: 'secret' },
            { type: 'thinking', thinking: '  \n ' },
            { type: 'text', text: 'visible' },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'thinking', thinking: 'injected' },
            { type: 'text', text: 'user text' },
          ],
        },
      ],
    });

    expect(value.messages[0]).toHaveProperty('reasoning_content', 'unsigned\n  \n ');
    expect(value.messages[0]).toHaveProperty('content', 'visible');
    expect(value.messages[1]).toHaveProperty('content', 'user text');
  });

  it.each([
    ['GPT', gptSignature(), true],
    ['Claude', 'claude#EjQ=', false],
    ['Gemini', 'gemini#EjQKMgEMOdbHO0Gd', false],
    ['unknown', 'not-a-provider-signature', false],
  ])('should classify %s signed thinking compatibility', (_name, signature, expected) => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'provider state', signature },
            { type: 'text', text: 'visible answer' },
          ],
        },
      ],
    });

    expect('reasoning_content' in (value.messages[0] ?? {})).toBe(expected);
    expect(value.messages[0]).toHaveProperty('content', 'visible answer');
  });
});

describe('Claude thinking-only messages crossing Chat Completions', () => {
  it('should preserve an unsigned thinking-only assistant message', () => {
    const value = translated({
      messages: [
        { role: 'user', content: 'question' },
        { role: 'assistant', content: [{ type: 'thinking', thinking: 'internal only' }] },
        { role: 'user', content: 'thanks' },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(value.messages[1]).toHaveProperty('reasoning_content', 'internal only');
  });

  it('should preserve empty-signature thinking only in compat mode', () => {
    const request: AnthropicRequest = {
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'reason', signature: '' }],
        },
      ],
    };
    const decoded = decodeRequestWithCompat(request);
    const normal = translateRequest('anthropic', 'chat-completions', request);

    if ('refusal' in decoded) throw new Error('expected compat decode');

    expect('refusal' in normal).toBe(true);
    expect(encodeRequestWithCompat(decoded.value).value.messages[0]).toHaveProperty(
      'reasoning_content',
      'reason',
    );
  });
});

describe('Claude system surfaces crossing Chat Completions', () => {
  it('should keep top-level system content and wrap message-level system reminders', () => {
    const value = translated({
      system: 'Top-level rules',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'system', content: 'Mid-conversation rule' },
        { role: 'assistant', content: 'Hi' },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'user',
      'assistant',
    ]);
    expect(value.messages[2]).toHaveProperty(
      'content',
      '<system-reminder>\nMid-conversation rule\n</system-reminder>',
    );
  });

  it('should omit empty system content and Claude Code billing attribution', () => {
    const value = translated({
      system: [
        { type: 'text', text: '' },
        { type: 'text', text: 'x-anthropic-billing-header: cc_version=2.1.63;' },
        { type: 'text', text: 'User system prompt' },
      ],
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(value.messages[0]).toEqual({ role: 'system', content: 'User system prompt' });
  });
});

describe('Claude tool surfaces crossing Chat Completions', () => {
  it('should add missing properties to every nested object schema', () => {
    const value = translated({
      tools: [
        { name: 'empty', input_schema: { type: 'object' } },
        {
          name: 'nested',
          input_schema: {
            type: 'object',
            properties: {
              nested: { type: 'object' },
              items: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      ],
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(value).toHaveProperty('tools.0.function.parameters.properties', {});
    expect(value).toHaveProperty('tools.1.function.parameters.properties.nested.properties', {});
    expect(value).toHaveProperty(
      'tools.1.function.parameters.properties.items.items.properties',
      {},
    );
  });
});

describe('Claude tool results crossing Chat Completions', () => {
  it('should place tool results immediately after calls and retain surrounding user text', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call_1', name: 'work', input: {} }],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'before' },
            { type: 'tool_result', tool_use_id: 'call_1', content: 'tool ok' },
            { type: 'text', text: 'after' },
          ],
        },
      ],
    });

    expect(value.messages.map((message) => message.role)).toEqual(['assistant', 'tool', 'user']);
    expect(value.messages[1]).toHaveProperty('content', 'tool ok');
    expect(value.messages[2]).toHaveProperty('content', [
      { type: 'text', text: 'before' },
      { type: 'text', text: 'after' },
    ]);
  });

  it('should preserve object and image tool-result content', () => {
    const object = translated(toolResult({ foo: 'bar' }));
    const images = translated(
      toolResult([
        { type: 'text', text: 'tool ok' },
        { type: 'image', source: { type: 'url', url: 'https://example.com/tool.png' } },
      ]),
    );

    expect(object.messages[1]).toHaveProperty('content', '{"foo":"bar"}');
    expect(images.messages[1]).toHaveProperty('content', [
      { type: 'text', text: 'tool ok' },
      { type: 'image_url', image_url: { url: 'https://example.com/tool.png' } },
    ]);
  });
});

describe('Claude assistant tool order crossing Chat Completions', () => {
  it('should keep assistant text and unsigned thinking around a tool call', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'drop' },
            { type: 'text', text: 'pre' },
            { type: 'tool_use', id: 'call_1', name: 'work', input: {} },
            { type: 'text', text: 'post' },
          ],
        },
      ],
    });

    expect(value.messages[0]).toHaveProperty('content', [
      { type: 'text', text: 'pre' },
      { type: 'text', text: 'post' },
    ]);
    expect(value.messages[0]).toHaveProperty('tool_calls.0.id', 'call_1');
    expect(value.messages[0]).toHaveProperty('reasoning_content', 'drop');
  });
});

function translated(request: AnthropicRequest) {
  const result = translateRequest('anthropic', 'chat-completions', request);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected Chat request');

  return result.value;
}

function gptSignature(): string {
  const raw = Buffer.alloc(73);

  raw[0] = 0x80;
  raw[8] = 1;

  return raw.toString('base64url');
}

function toolResult(content: unknown): AnthropicRequest {
  return {
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'call_1', name: 'work', input: {} }],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content }] },
    ],
  };
}

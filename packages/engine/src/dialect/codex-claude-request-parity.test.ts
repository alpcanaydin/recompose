import { describe, expect, it } from 'vitest';

import { decodeRequestWithCompat } from './anthropic-request-decode';
import {
  codexSignature,
  grokSignature,
  orderedRequest,
  reasoningRequest,
  responseToolName,
  toolChoice,
  translated,
  user,
} from './codex-claude-request-parity.testkit';
import { encodeRequest as encodeResponses } from './responses-request-encode';

describe('Codex Claude request parity', () => {
  it('should convert only meaningful top-level system blocks to a developer message', () => {
    const value = translated({
      system: [
        { type: 'text', text: 'x-anthropic-billing-header: tenant-123' },
        { type: 'text', text: 'Block 1' },
        { type: 'text', text: 'Block 2' },
      ],
      messages: [user('hello')],
    });

    expect(value.input[0]).toEqual({
      type: 'message',
      role: 'developer',
      content: [
        { type: 'input_text', text: 'Block 1' },
        { type: 'input_text', text: 'Block 2' },
      ],
    });
    expect(translated({ system: '', messages: [user('hello')] }).input[0]).not.toHaveProperty(
      'role',
      'developer',
    );
  });

  it('should wrap message-level system roles as user reminders', () => {
    const value = translated({
      system: 'Top-level rules',
      messages: [user('hello'), { role: 'system', content: 'Follow the project instructions' }],
    });

    expect(value.input).toContainEqual({
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: '<system-reminder>\nFollow the project instructions\n</system-reminder>',
        },
      ],
    });
  });
});

describe('Codex Claude request parallel controls', () => {
  it('should map parallel tool controls and default to enabled', () => {
    expect(translated({ messages: [user('hi')] }).parallel_tool_calls).toBe(true);
    expect(
      translated({
        messages: [user('hi')],
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      }).parallel_tool_calls,
    ).toBe(false);
    expect(
      translated({
        messages: [user('hi')],
        tool_choice: { type: 'auto', disable_parallel_tool_use: false },
      }).parallel_tool_calls,
    ).toBe(true);
  });
});

describe('Codex Claude request controls and identifiers', () => {
  it('should normalize priority service tiers and fast speed', () => {
    expect(translated({ messages: [user('hi')], service_tier: 'fast' }).service_tier).toBe(
      'priority',
    );
    expect(translated({ messages: [user('hi')], speed: 'fast' }).service_tier).toBe('priority');
    expect(
      translated({ messages: [user('hi')], service_tier: 'default' }).service_tier,
    ).toBeUndefined();
  });

  it('should shorten long tool-use IDs consistently', () => {
    const id = `toolu_${'x'.repeat(100)}`;
    const value = translated({
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id, name: 'lookup', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
      ],
    });
    const call = value.input.find((item) => item.type === 'function_call');
    const output = value.input.find((item) => item.type === 'function_call_output');

    expect(call?.call_id).toHaveLength(64);
    expect(output?.call_id).toBe(call?.call_id);
  });

  it('should map Claude tool choice modes', () => {
    expect(toolChoice('auto')).toBe('auto');
    expect(toolChoice('any')).toBe('required');
    expect(toolChoice('none')).toBe('none');
  });

  it('should apply the shortened declared name to a specific tool choice', () => {
    const name = `mcp__${'long_server_'.repeat(8)}search`;
    const value = translated({
      messages: [user('hi')],
      tools: [{ name, input_schema: { type: 'object' } }],
      tool_choice: { type: 'tool', name },
    });
    const tool = value.tools?.[0];
    const toolName = responseToolName(tool);

    expect(toolName).toHaveLength(64);
    expect(value.tool_choice).toEqual({ type: 'function', name: toolName });
  });
});

describe('Codex Claude request web tools', () => {
  it('should map typed web search tools and drop blocked domains', () => {
    const value = translated({
      messages: [user('hi')],
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          allowed_domains: ['example.com'],
          blocked_domains: ['blocked.example'],
          user_location: { city: 'Beijing', country: 'CN' },
        },
      ],
      tool_choice: { type: 'tool', name: 'web_search' },
    });

    expect(value.tools?.[0]).toEqual({
      type: 'web_search',
      filters: { allowed_domains: ['example.com'] },
      user_location: { city: 'Beijing', country: 'CN' },
    });
    expect(value.tool_choice).toEqual({ type: 'web_search' });
  });

  it('should use a declared function when its name differs from the typed web tool', () => {
    const value = translated({
      messages: [user('hi')],
      tools: [
        { type: 'web_search_20250305', name: 'browser_search' },
        { name: 'web_search', input_schema: { type: 'object' } },
      ],
      tool_choice: { type: 'tool', name: 'web_search' },
    });

    expect(value.tool_choice).toEqual({ type: 'function', name: 'web_search' });
  });
});

describe('Codex Claude request reasoning and documents', () => {
  it('should replay an assistant Codex reasoning signature without visible thinking', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'do not replay', signature: codexSignature() },
            { type: 'text', text: 'answer' },
          ],
        },
      ],
    });

    expect(value.input[0]).toMatchObject({ type: 'reasoning', summary: [], content: null });
    expect(JSON.stringify(value)).not.toContain('do not replay');
  });

  it('should preserve a base64 PDF between surrounding text', () => {
    const value = translated({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'before' },
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQK' },
            },
            { type: 'text', text: 'after' },
          ],
        },
      ],
    });

    expect(value.input[0]).toHaveProperty('content', [
      { type: 'input_text', text: 'before' },
      {
        type: 'input_file',
        file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
        filename: 'document.pdf',
      },
      { type: 'input_text', text: 'after' },
    ]);
  });
});

describe('Codex Claude request ordering and signature compatibility', () => {
  it('should preserve text, reasoning, tool, result media, and continuation order', () => {
    const value = translated(orderedRequest());

    expect(value.input.map((item) => item.type)).toEqual([
      'message',
      'message',
      'reasoning',
      'message',
      'function_call',
      'message',
      'function_call_output',
      'message',
    ]);
    expect(value.input[6]).toHaveProperty('output.1.image_url', 'data:image/png;base64,aW1hZ2U=');
  });

  it('should preserve a Grok signature only for Grok targets', () => {
    const grok = translated(reasoningRequest('grok-4.5', grokSignature()));
    const gpt = translated(reasoningRequest('gpt-5.4', grokSignature()));

    expect(grok.input[0]).toHaveProperty('type', 'reasoning');
    expect(gpt.input.some((item) => item.type === 'reasoning')).toBe(false);
  });

  it('should ignore user and native Claude thinking signatures', () => {
    const userThinking = translated({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'thinking', thinking: 'private', signature: codexSignature() },
            { type: 'text', text: 'hi' },
          ],
        },
      ],
    });
    const native = translated(reasoningRequest('gpt-5.4', 'Eo8Canthropic-state'));

    expect(userThinking.input.some((item) => item.type === 'reasoning')).toBe(false);
    expect(native.input.some((item) => item.type === 'reasoning')).toBe(false);
  });

  it('should preserve empty-signature thinking only through compat decoding', () => {
    const decoded = decodeRequestWithCompat({
      messages: [
        { role: 'assistant', content: [{ type: 'thinking', thinking: 'reason', signature: '' }] },
      ],
    });

    if ('refusal' in decoded) throw new Error('expected request');

    expect(encodeResponses(decoded.value).value.input[0]).toMatchObject({
      type: 'reasoning',
      encrypted_content: '',
    });
  });
});

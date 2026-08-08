import { describe, expect, it } from 'vitest';

import type { ResponsesInputItem, ResponsesRequest } from './responses-wire';

import { decodeRequest, decodeRequestForChat } from './responses-request';

describe('a Responses request that offers web search', () => {
  it('should carry the domains and location the caller narrows search to', () => {
    const decoded = decodeRequest(
      requestWith({
        tools: [
          {
            type: 'web_search',
            filters: { allowed_domains: ['example.test'] },
            user_location: { country: 'TR' },
          },
        ],
      }),
    );

    expect(decoded).toHaveProperty('value.serverTools', [
      {
        type: 'web_search',
        name: 'web_search',
        allowedDomains: ['example.test'],
        userLocation: { country: 'TR' },
      },
    ]);
  });

  it('should leave search unnarrowed when the caller names neither', () => {
    const decoded = decodeRequest(requestWith({ tools: [{ type: 'web_search' }] }));

    expect(decoded).toHaveProperty('value.serverTools', [
      { type: 'web_search', name: 'web_search' },
    ]);
  });

  it('should honour a caller who insists on web search', () => {
    const decoded = decodeRequest(
      requestWith({ tools: [{ type: 'web_search' }], tool_choice: { type: 'web_search' } }),
    );

    expect(decoded).toHaveProperty('value.toolChoice', { type: 'web_search' });
  });

  it('should honour a caller who insists on one named tool', () => {
    const decoded = decodeRequest(
      requestWith({
        tools: [{ type: 'function', name: 'read_file', parameters: { type: 'object' } }],
        tool_choice: { type: 'function', name: 'read_file' },
      }),
    );

    expect(decoded).toHaveProperty('value.toolChoice', { type: 'tool', name: 'read_file' });
  });
});

describe('a Responses request that says nothing to answer', () => {
  it('should refuse a conversation left with no turns', () => {
    const decoded = decodeRequest({
      input: [{ type: 'function_call', call_id: 'call_1', name: 'read_file', arguments: '{}' }],
    });

    expect(decoded).toHaveProperty('refusal.reason', 'empty-conversation');
  });

  it('should refuse a tool answer that no call ever asked for', () => {
    const decoded = decodeRequestForChat({
      input: [
        userSaying('hello'),
        { type: 'function_call_output', call_id: 'call_absent', output: 'done' },
      ],
    });

    expect(decoded).toHaveProperty('refusal');
    expect(decoded).not.toHaveProperty('value');
  });
});

describe('a Responses request carrying extended tool items', () => {
  it('should fold a custom tool exchange into an ordinary call and result', () => {
    const decoded = decodeRequest({
      input: [
        userSaying('hello'),
        { type: 'additional_tools', tools: [] },
        { type: 'custom_tool_call', call_id: 'call_1', name: 'run_command', input: 'ls' },
        { type: 'custom_tool_call_output', call_id: 'call_1', output: 'done' },
      ],
    });

    expect(decoded).toHaveProperty('value.messages.1.content.0.type', 'tool_use');
    expect(decoded).toHaveProperty('value.messages.2.content.0.type', 'tool_result');
  });
});

function userSaying(text: string): ResponsesInputItem {
  return { type: 'message', role: 'user', content: [{ type: 'input_text', text }] };
}

function requestWith(extra: Omit<ResponsesRequest, 'input'>): ResponsesRequest {
  return { input: [userSaying('hello')], ...extra };
}

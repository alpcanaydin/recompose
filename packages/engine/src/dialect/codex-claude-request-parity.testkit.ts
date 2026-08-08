import type { AnthropicRequest } from './anthropic-wire';
import type { ResponsesRequest, ResponsesTool } from './responses-wire';

import { translateRequest } from './dispatcher';

export function translated(body: AnthropicRequest): ResponsesRequest {
  const result = translateRequest('anthropic', 'responses', body);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected request');

  return result.value;
}

export function user(content: string): AnthropicRequest['messages'][number] {
  return { role: 'user', content };
}

export function responseToolName(tool: ResponsesTool | undefined): string | undefined {
  return tool?.type === 'function' ? tool.name : undefined;
}

export function toolChoice(type: 'auto' | 'any' | 'none'): ResponsesRequest['tool_choice'] {
  return translated({
    messages: [user('hi')],
    tools: [{ name: 'lookup', input_schema: { type: 'object' } }],
    tool_choice: { type },
  }).tool_choice;
}

export function codexSignature(): string {
  const raw = Buffer.alloc(73);

  raw[0] = 0x80;
  raw[8] = 1;

  return raw.toString('base64url');
}

export function grokSignature(): string {
  return Buffer.alloc(180, 7).toString('base64');
}

export function reasoningRequest(model: string, signature: string): AnthropicRequest {
  return {
    model,
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'summary', signature },
          { type: 'text', text: 'answer' },
        ],
      },
    ],
  };
}

export function orderedRequest(): AnthropicRequest {
  return {
    system: 'system rules',
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'before reasoning' },
          { type: 'thinking', thinking: '', signature: codexSignature() },
          { type: 'text', text: 'before tool' },
          { type: 'tool_use', id: 'toolu_1', name: 'lookup', input: { query: 'test' } },
          { type: 'text', text: 'after tool' },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: [
              { type: 'text', text: 'tool output' },
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: 'aW1hZ2U=' },
              },
            ],
          },
          { type: 'text', text: 'continue' },
        ],
      },
    ],
    tools: [{ name: 'lookup', input_schema: { type: 'object' } }],
  };
}

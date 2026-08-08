import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import type { HubMessage } from './hub';

import { decodeRequest, encodeRequest } from './chat-completions-request';
import {
  aChatAssistantMessage,
  aChatRequest,
  aChatToolCall,
  aChatToolMessage,
  aChatUserMessage,
} from './chat-completions.testkit';
import {
  aHubImageBlock,
  aHubMessage,
  aHubRedactedThinkingBlock,
  aHubRequest,
  aHubTextBlock,
  aHubThinkingBlock,
  aHubTool,
  aHubToolResultBlock,
  aHubToolUseBlock,
} from './hub.testkit';

describe('encodeRequest folds the hub back into a Chat Completions request', () => {
  it('carries unsigned thinking toward Chat Completions with a cost-bearing fate', () => {
    const history: HubMessage = {
      role: 'assistant',
      content: [aHubThinkingBlock(), aHubTextBlock({ text: 'Sunny.' })],
    };
    const hub = aHubRequest({ messages: [aHubMessage(), history] });

    const { value, fates } = encodeRequest(hub);

    expect(value.messages[1]).toHaveProperty(
      'reasoning_content',
      'weigh the two routes before answering',
    );
    expect(fates).toContainEqual(
      expect.objectContaining({
        field: 'thinking',
        disposition: 'mapped',
        to: 'absent',
        costBearing: true,
      }),
    );
  });

  it('renders a hub tool_use into a chat assistant tool call', () => {
    const assistant: HubMessage = {
      role: 'assistant',
      content: [aHubToolUseBlock({ id: 'call_x', name: 'lookup' })],
    };

    const { value } = encodeRequest(aHubRequest({ messages: [assistant] }));

    expect(value.messages.find((message) => message.role === 'assistant')).toMatchObject({
      tool_calls: [{ id: 'call_x', function: { name: 'lookup' } }],
    });
  });

  it('renders a tool_result user message as a chat tool message', () => {
    const user: HubMessage = {
      role: 'user',
      content: [aHubToolResultBlock({ toolUseId: 'call_r' })],
    };
    const { value } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(value.messages.find((message) => message.role === 'tool')).toMatchObject({
      tool_call_id: 'call_r',
    });
  });
});

describe('encodeRequest drops a redacted thinking block toward Chat Completions', () => {
  it('drops a redacted thinking block from a user turn with a cost-bearing fate', () => {
    const user: HubMessage = {
      role: 'user',
      content: [
        aHubRedactedThinkingBlock({ data: 'opaque-redacted-payload' }),
        aHubTextBlock({ text: 'carry on' }),
      ],
    };

    const { value, fates } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(JSON.stringify(value)).not.toContain('opaque-redacted-payload');
    expect(fates).toContainEqual(
      expect.objectContaining({
        field: 'redacted_thinking',
        disposition: 'mapped',
        to: 'absent',
        costBearing: true,
      }),
    );
  });
});

describe('encodeRequest renders the richer hub content blocks', () => {
  it('renders a base64 image block as a data url image part', () => {
    const user: HubMessage = { role: 'user', content: [aHubImageBlock()] };
    const { value } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(JSON.stringify(value.messages)).toContain('data:image/png;base64,');
  });

  it('renders a url image block as an image_url part', () => {
    const user: HubMessage = {
      role: 'user',
      content: [aHubImageBlock({ source: { type: 'url', url: 'https://x.test/cat.png' } })],
    };
    const { value } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(JSON.stringify(value.messages)).toContain('https://x.test/cat.png');
  });

  it('drops a stray tool_use and a thinking block in a user message, each with a fate', () => {
    const user: HubMessage = { role: 'user', content: [aHubThinkingBlock(), aHubToolUseBlock()] };
    const { fates } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(fates).toContainEqual(expect.objectContaining({ field: 'thinking', costBearing: true }));
    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'tool_use', disposition: 'mapped' }),
    );
  });

  it('drops an image and a tool_result inside an assistant message, each with a fate', () => {
    const assistant: HubMessage = {
      role: 'assistant',
      content: [aHubImageBlock(), aHubToolResultBlock()],
    };
    const { fates } = encodeRequest(aHubRequest({ messages: [assistant] }));

    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'image', disposition: 'mapped' }),
    );
    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'tool_result', disposition: 'mapped' }),
    );
  });
});

describe('encodeRequest renders the tool choice and sampling knobs', () => {
  it('renders each hub tool choice back into the chat form', () => {
    expect(encodeRequest(aHubRequest({ toolChoice: { type: 'auto' } })).value.tool_choice).toBe(
      'auto',
    );
    expect(encodeRequest(aHubRequest({ toolChoice: { type: 'none' } })).value.tool_choice).toBe(
      'none',
    );
    expect(encodeRequest(aHubRequest({ toolChoice: { type: 'required' } })).value.tool_choice).toBe(
      'required',
    );
    expect(
      encodeRequest(aHubRequest({ toolChoice: { type: 'tool', name: 'x' } })).value.tool_choice,
    ).toEqual({
      type: 'function',
      function: { name: 'x' },
    });
  });

  it('renders the sampling knobs and a tool that requires a parameter', () => {
    const hub = aHubRequest({
      tools: [
        aHubTool({ inputSchema: { type: 'object', properties: { a: {} }, required: ['a'] } }),
      ],
      sampling: { maxOutputTokens: 100, temperature: 0.5, topP: 0.7, stop: ['x'] },
    });
    const { value } = encodeRequest(hub);

    const tool = value.tools?.find((candidate) => candidate.type === 'function');

    expect(tool?.function.parameters.required).toEqual(['a']);
    expect(value.max_tokens).toBe(100);
    expect(value.temperature).toBe(0.5);
    expect(value.top_p).toBe(0.7);
    expect(value.stop).toEqual(['x']);
  });

  it('omits the chat sampling knobs the hub sampling leaves unset', () => {
    const { value } = encodeRequest(aHubRequest({ sampling: {} }));

    expect(value.max_tokens).toBeUndefined();
    expect(value.temperature).toBeUndefined();
    expect(value.top_p).toBeUndefined();
    expect(value.stop).toBeUndefined();
  });

  it('leaves the chat tools and tool choice unset when the hub names neither', () => {
    const { value } = encodeRequest(aHubRequest());

    expect(value.tools).toBeUndefined();
    expect(value.tool_choice).toBeUndefined();
  });
});

describe('encodeRequest records the exact fate for each field it maps', () => {
  it('names the system, tools, tool choice, and sampling destinations exactly', () => {
    const hub = aHubRequest({
      system: [{ text: 'lead' }],
      tools: [aHubTool()],
      toolChoice: { type: 'auto' },
      sampling: { maxOutputTokens: 100 },
    });

    const { fates } = encodeRequest(hub);

    expect(fates).toContainEqual({
      field: 'system',
      disposition: 'mapped',
      to: 'messages[system]',
    });
    expect(fates).toContainEqual({ field: 'tools', disposition: 'carried' });
    expect(fates).toContainEqual({ field: 'toolChoice', disposition: 'mapped', to: 'tool_choice' });
    expect(fates).toContainEqual({ field: 'sampling', disposition: 'mapped', to: 'sampling' });
  });

  it('names the thinking, image, tool_use, and tool_result drops exactly', () => {
    const assistant: HubMessage = {
      role: 'assistant',
      content: [aHubThinkingBlock(), aHubImageBlock(), aHubToolResultBlock()],
    };
    const user: HubMessage = { role: 'user', content: [aHubToolUseBlock()] };

    const { fates } = encodeRequest(aHubRequest({ messages: [assistant, user] }));

    expect(fates).toContainEqual({
      field: 'thinking',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
    expect(fates).toContainEqual({ field: 'image', disposition: 'mapped', to: 'absent' });
    expect(fates).toContainEqual({ field: 'tool_result', disposition: 'mapped', to: 'absent' });
    expect(fates).toContainEqual({ field: 'tool_use', disposition: 'mapped', to: 'absent' });
  });
});

const nonEmptyText = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((text) => text.trim().length > 0);

const toolArguments = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 6 }),
  fc.string({ maxLength: 8 }),
  {
    maxKeys: 3,
  },
);

describe('a decode-then-encode round trip preserves text and tool-call pairing', () => {
  test.prop([nonEmptyText, fc.string({ minLength: 1, maxLength: 8 }), toolArguments])(
    'the user text, the tool call, and its answering result survive the crossing',
    (userText, toolName, args) => {
      const request = aChatRequest({
        messages: [
          aChatUserMessage({ content: userText }),
          aChatAssistantMessage({
            content: null,
            tool_calls: [
              aChatToolCall({
                id: 'call_rt',
                function: { name: toolName, arguments: JSON.stringify(args) },
              }),
            ],
          }),
          aChatToolMessage({ tool_call_id: 'call_rt' }),
        ],
      });

      const decoded = decodeRequest(request);

      if ('refusal' in decoded) {
        throw new Error('the round-trip request refused unexpectedly');
      }

      const { value } = encodeRequest(decoded.value);

      const user = value.messages.find((message) => message.role === 'user');
      const assistant = value.messages.find((message) => message.role === 'assistant');
      const tool = value.messages.find((message) => message.role === 'tool');

      expect(user?.content).toBe(userText);
      expect(assistant).toMatchObject({
        tool_calls: [{ id: 'call_rt', function: { name: toolName } }],
      });
      expect(tool).toMatchObject({ tool_call_id: 'call_rt' });
    },
  );
});

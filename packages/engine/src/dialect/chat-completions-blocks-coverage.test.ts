import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest, ChatToolMessage } from './chat-completions-wire';
import type { HubContentBlock, HubRequest } from './hub';

import { decodeRequest, decodeResponse, encodeRequest } from './chat-completions-codec';
import { aChatRequest, aChatUserMessage } from './chat-completions.testkit';

function decodedBlocks(overrides: Partial<ChatCompletionsRequest>): readonly HubContentBlock[] {
  const decoded = decodeRequest(aChatRequest(overrides));

  if ('refusal' in decoded) throw new Error('the chat request was refused');

  return decoded.value.messages.flatMap((message) => message.content);
}

function toolBlocks(blocks: readonly HubContentBlock[]) {
  return blocks.filter((block) => block.type === 'tool_use');
}

const answered: ChatToolMessage = { role: 'tool', tool_call_id: 'call_1', content: 'done' };

function assistantSaying(block: HubContentBlock): HubRequest {
  return {
    messages: [{ role: 'assistant', content: [{ type: 'text', text: 'here it is' }, block] }],
    sampling: { maxOutputTokens: 64 },
  };
}

describe('a chat function call answering a tool the request declares as custom', () => {
  it('keeps the arguments as the raw text the custom tool wrote', () => {
    const blocks = decodedBlocks({
      messages: [
        aChatUserMessage(),
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'shell', arguments: 'ls -la' } },
          ],
        },
        answered,
      ],
      tools: [{ type: 'custom', name: 'shell' }],
    });

    expect(toolBlocks(blocks)[0]).toMatchObject({
      name: 'shell',
      input: 'ls -la',
      family: 'custom',
    });
  });
});

describe('a chat custom tool call that arrives without an identity', () => {
  it('answers to the placeholder identity the gateway assigns', () => {
    const blocks = decodedBlocks({
      messages: [
        aChatUserMessage(),
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_missing', type: 'function', function: { name: 'note', arguments: '{}' } },
            { type: 'custom', custom: { name: 'shell', input: 'ls' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_missing', content: 'done' },
      ],
    });

    expect(toolBlocks(blocks)[1]).toMatchObject({
      id: 'call_missing',
      name: 'shell',
      input: 'ls',
      family: 'custom',
    });
  });
});

describe('a chat function call answered without an identity', () => {
  it('takes the placeholder identity the gateway assigns', () => {
    const decoded = decodeResponse({
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ type: 'function', function: { name: 'lookup', arguments: '{}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });

    expect(toolBlocks(decoded.value.content)[0]).toMatchObject({
      id: 'call_missing',
      name: 'lookup',
    });
  });
});

describe('an assistant turn carrying media the chat wire cannot hold', () => {
  it('records a dropped image as costing nothing', () => {
    const fates = encodeRequest(
      assistantSaying({
        type: 'image',
        source: { type: 'base64', mediaType: 'image/png', data: 'AA==' },
      }),
    ).fates;

    expect(fates).toContainEqual({ field: 'image', disposition: 'mapped', to: 'absent' });
  });

  it('records a dropped document as cost bearing', () => {
    const fates = encodeRequest(
      assistantSaying({
        type: 'document',
        source: { type: 'url', url: 'https://example.com/a.pdf' },
        filename: 'a.pdf',
      }),
    ).fates;

    expect(fates).toContainEqual({
      field: 'document',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

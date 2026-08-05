import { describe, expect, it } from 'vitest';

import type { HubMessage, HubToolResultBlock, HubToolUseBlock } from './hub';

import { decodeRequest } from './chat-completions-request';
import {
  aChatAssistantMessage,
  aChatRequest,
  aChatToolCall,
  aChatToolMessage,
  aChatUserMessage,
} from './chat-completions.testkit';

function decoded(request: Parameters<typeof decodeRequest>[0]): HubMessage[] {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return [...result.value.messages];
}

function blocksOf(messages: readonly HubMessage[]) {
  return messages.flatMap((message) => message.content);
}

describe('decodeRequest sanitizes tool ids the wire allows but Anthropic forbids', () => {
  it('sanitizes an unsafe id on both the tool call and the result answering it', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage(),
        aChatAssistantMessage({
          content: null,
          tool_calls: [aChatToolCall({ id: 'call.with space:1' })],
        }),
        aChatToolMessage({ tool_call_id: 'call.with space:1' }),
      ],
    });

    const blocks = blocksOf(decoded(request));
    const use = blocks.find((block): block is HubToolUseBlock => block.type === 'tool_use');
    const result = blocks.find(
      (block): block is HubToolResultBlock => block.type === 'tool_result',
    );

    expect(use?.id).toBe('call_with_space_1');
    expect(result?.toolUseId).toBe('call_with_space_1');
  });
});

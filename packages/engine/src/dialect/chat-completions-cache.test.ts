import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest } from './chat-completions-wire';
import type { HubMessage, HubRequest, HubTextBlock } from './hub';

import { decodeRequest, encodeRequest } from './chat-completions-request';
import { aChatRequest, aChatSystemMessage, aChatUserMessage } from './chat-completions.testkit';
import { aHubRequest, aHubSystemText, aHubTextBlock } from './hub.testkit';

function decodedValue(request: ChatCompletionsRequest): HubRequest {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result.value;
}

function firstTextBlock(value: HubRequest): HubTextBlock | undefined {
  return value.messages
    .flatMap((message) => message.content)
    .find((block): block is HubTextBlock => block.type === 'text');
}

describe('decodeRequest carries an Anthropic cache_control breakpoint into the hub', () => {
  it('marks a hub text block with the breakpoint a message-level cache_control declares', () => {
    const request = aChatRequest({
      messages: [aChatUserMessage({ content: 'cache me', cache_control: { type: 'ephemeral' } })],
    });

    expect(firstTextBlock(decodedValue(request))?.cacheBreakpoint).toEqual({ type: 'ephemeral' });
  });

  it('honors a content part that carries its own cache_control the message never sets', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage({
          content: [{ type: 'text', text: 'own', cache_control: { type: 'ephemeral' } }],
        }),
      ],
    });

    expect(firstTextBlock(decodedValue(request))?.cacheBreakpoint).toEqual({ type: 'ephemeral' });
  });

  it('lands a system cache_control on the last hub system text', () => {
    const request = aChatRequest({
      messages: [
        aChatSystemMessage({ content: 'be terse', cache_control: { type: 'ephemeral' } }),
        aChatUserMessage(),
      ],
    });

    expect(decodedValue(request).system?.at(-1)?.cacheBreakpoint).toEqual({ type: 'ephemeral' });
  });
});

describe('encodeRequest carries a hub cache breakpoint back onto Chat Completions', () => {
  it('renders a text block breakpoint as cache_control on the user message', () => {
    const user: HubMessage = {
      role: 'user',
      content: [aHubTextBlock({ text: 'cache me', cacheBreakpoint: { type: 'ephemeral' } })],
    };

    const { value } = encodeRequest(aHubRequest({ messages: [user] }));
    const message = value.messages.find((entry) => entry.role === 'user');

    expect(message?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('renders a system text breakpoint as cache_control on the system message', () => {
    const hub = aHubRequest({
      system: [aHubSystemText({ text: 'be terse', cacheBreakpoint: { type: 'ephemeral' } })],
    });

    const { value } = encodeRequest(hub);
    const message = value.messages.find((entry) => entry.role === 'system');

    expect(message?.cache_control).toEqual({ type: 'ephemeral' });
  });
});

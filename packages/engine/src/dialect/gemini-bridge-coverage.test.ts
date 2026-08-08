import { describe, expect, it } from 'vitest';

import {
  aChatAssistantMessage,
  aChatRequest,
  aChatToolMessage,
  aChatUserMessage,
} from './chat-completions.testkit';
import { translateRequestToGemini } from './gemini-bridge';

describe('translateRequestToGemini: a chat history that ends on the assistant', () => {
  it('keeps a trailing assistant turn that re-issues an answered tool call', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage(),
        aChatAssistantMessage(),
        aChatToolMessage(),
        aChatAssistantMessage(),
      ],
    });

    const translated = translateRequestToGemini('chat-completions', request);

    expect('value' in translated && JSON.stringify(translated.value)).toContain('get_weather');
  });

  it('drops a trailing assistant turn that only restates text', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage(),
        aChatAssistantMessage({ content: 'Sunny, 21C.', tool_calls: [] }),
      ],
    });

    const translated = translateRequestToGemini('chat-completions', request);

    expect('value' in translated && JSON.stringify(translated.value)).not.toContain('Sunny, 21C.');
  });
});

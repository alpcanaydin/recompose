import { describe, expect, it } from 'vitest';

import {
  aHubImageBlock,
  aHubMessage,
  aHubRedactedThinkingBlock,
  aHubRequest,
  aHubSystemText,
  aHubTextBlock,
  aHubThinkingBlock,
  aHubTool,
  aHubToolResultBlock,
  aHubToolUseBlock,
} from './hub.testkit';
import { encodeRequest } from './responses-codec';
import { expectTranslation, fateFor } from './responses.testkit';

describe('encodeRequest: the request frame crosses back to Responses', () => {
  it('keeps the system, the tools, the tool choice, and the input crossing to Responses', () => {
    const request = aHubRequest({
      system: [aHubSystemText({ text: 'You answer concisely.' })],
      tools: [aHubTool()],
      toolChoice: { type: 'tool', name: 'get_weather' },
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.instructions).toBe('You answer concisely.');
    expect(value.tools?.[0]).toEqual({
      type: 'function',
      name: 'get_weather',
      description: 'Look up the weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        additionalProperties: false,
      },
    });
    expect(value.tool_choice).toEqual({ type: 'function', name: 'get_weather' });
    expect(value.input[0]).toEqual({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'hello from the hub' }],
    });
  });

  it('joins several system texts into one instructions string by newline', () => {
    const request = aHubRequest({
      system: [
        aHubSystemText({ text: 'Be concise' }),
        aHubSystemText({ text: 'Answer in English' }),
      ],
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.instructions).toBe('Be concise\nAnswer in English');
  });

  it('carries hub sampling into temperature, top-p, and the output-token ceiling', () => {
    const request = aHubRequest({
      sampling: { maxOutputTokens: 256, temperature: 0.5, topP: 0.8 },
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.temperature).toBe(0.5);
    expect(value.top_p).toBe(0.8);
    expect(value.max_output_tokens).toBe(256);
  });
});

describe('encodeRequest: content blocks render as Responses items', () => {
  it('renders a tool_use block as a function_call input item', () => {
    const request = aHubRequest({
      messages: [aHubMessage({ role: 'assistant', content: [aHubToolUseBlock()] })],
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.input[0]).toEqual({
      type: 'function_call',
      call_id: 'toolu_weather',
      name: 'get_weather',
      arguments: '{"city":"Paris"}',
    });
  });

  it('renders a tool_result block as a function_call_output input item', () => {
    const request = aHubRequest({
      messages: [aHubMessage({ role: 'user', content: [aHubToolResultBlock()] })],
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.input[0]).toEqual({
      type: 'function_call_output',
      call_id: 'toolu_weather',
      output: 'sunny, 21C',
    });
  });

  it('drops a thinking block toward Responses with a cost-bearing fate', () => {
    const request = aHubRequest({
      messages: [
        aHubMessage({
          role: 'assistant',
          content: [aHubThinkingBlock(), aHubTextBlock({ text: 'Sunny.' })],
        }),
      ],
    });

    const { value, fates } = expectTranslation(encodeRequest(request));

    const reasoning = value.input.flatMap((item) => (item.type === 'reasoning' ? [item] : []));

    expect(reasoning).toHaveLength(0);
    expect(fateFor(fates, 'thinking')).toEqual({
      field: 'thinking',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

describe('encodeRequest drops a redacted thinking block toward Responses', () => {
  it('drops a redacted thinking block toward Responses with a cost-bearing fate', () => {
    const request = aHubRequest({
      messages: [
        aHubMessage({
          role: 'assistant',
          content: [aHubRedactedThinkingBlock({ data: 'opaque-redacted-payload' })],
        }),
      ],
    });

    const { value, fates } = expectTranslation(encodeRequest(request));

    expect(JSON.stringify(value)).not.toContain('opaque-redacted-payload');
    expect(fateFor(fates, 'redacted_thinking')).toEqual({
      field: 'redacted_thinking',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

describe('encodeRequest: sampling carries only the knobs the hub set', () => {
  it('omits temperature, top-p, and the ceiling when the hub left sampling empty', () => {
    const { value } = expectTranslation(encodeRequest(aHubRequest({ sampling: {} })));

    expect(value.temperature).toBeUndefined();
    expect(value.top_p).toBeUndefined();
    expect(value.max_output_tokens).toBeUndefined();
  });
});

describe('encodeRequest: the tool choice crosses to the Responses vocabulary', () => {
  it('maps auto, none, and required to their Responses strings', () => {
    const auto = expectTranslation(encodeRequest(aHubRequest({ toolChoice: { type: 'auto' } })));
    const none = expectTranslation(encodeRequest(aHubRequest({ toolChoice: { type: 'none' } })));
    const required = expectTranslation(
      encodeRequest(aHubRequest({ toolChoice: { type: 'required' } })),
    );

    expect(auto.value.tool_choice).toBe('auto');
    expect(none.value.tool_choice).toBe('none');
    expect(required.value.tool_choice).toBe('required');
  });
});

describe('encodeRequest: images cross as input_image parts', () => {
  it('renders a url image source as an input_image part carrying the url', () => {
    const request = aHubRequest({
      messages: [
        aHubMessage({
          content: [
            aHubImageBlock({ source: { type: 'url', url: 'https://example.test/cat.png' } }),
          ],
        }),
      ],
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.input[0]).toEqual({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_image', image_url: 'https://example.test/cat.png' }],
    });
  });

  it('renders a base64 image source as a data url', () => {
    const request = aHubRequest({ messages: [aHubMessage({ content: [aHubImageBlock()] })] });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.input[0]).toEqual({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }],
    });
  });

  it('joins only the text parts of a tool result into the output string', () => {
    const request = aHubRequest({
      messages: [
        aHubMessage({
          role: 'user',
          content: [
            aHubToolResultBlock({ content: [aHubTextBlock({ text: 'ok' }), aHubImageBlock()] }),
          ],
        }),
      ],
    });

    const { value } = expectTranslation(encodeRequest(request));

    expect(value.input[0]).toEqual({
      type: 'function_call_output',
      call_id: 'toolu_weather',
      output: 'ok',
    });
  });
});

describe('encodeRequest drops a tool-result image toward Responses', () => {
  it('keeps the text of a tool result and names the dropped image with a cost-bearing fate', () => {
    const request = aHubRequest({
      messages: [
        aHubMessage({
          role: 'user',
          content: [
            aHubToolResultBlock({
              content: [
                { type: 'text', text: 'ok' },
                { type: 'image', source: { type: 'url', url: 'https://example.test/y.png' } },
              ],
            }),
          ],
        }),
      ],
    });

    const { value, fates } = expectTranslation(encodeRequest(request));

    expect(JSON.stringify(value)).not.toContain('y.png');
    expect(fateFor(fates, 'tool_result_image')).toEqual({
      field: 'tool_result_image',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });

  it('records no image fate when a tool result carries only text', () => {
    const request = aHubRequest({
      messages: [aHubMessage({ role: 'user', content: [aHubToolResultBlock()] })],
    });

    const { fates } = expectTranslation(encodeRequest(request));

    expect(fates.some((fate) => fate.field === 'tool_result_image')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import type { HubMessage } from './hub';

import { decodeRequest } from './responses-codec';
import {
  aResponsesFunctionCall,
  aResponsesFunctionCallOutput,
  aResponsesRequest,
  aResponsesTool,
  expectTranslation,
  toolResultsOf,
  toolUsesOf,
} from './responses.testkit';

function isToolResultTurn(message: HubMessage): boolean {
  return message.role === 'user' && message.content.every((block) => block.type === 'tool_result');
}

describe('decodeRequest: a tool id crosses safely to a strict target', () => {
  it('sanitizes a tool id the same way on the tool_use and its answering tool_result', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call.x:1' }),
        aResponsesFunctionCallOutput({ call_id: 'call.x:1' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolUsesOf(value.messages)[0]?.id).toBe('call_x_1');
    expect(toolResultsOf(value.messages)[0]?.toolUseId).toBe('call_x_1');
  });
});

describe('decodeRequest: a malformed tool argument degrades rather than crashing', () => {
  it('reads unparseable function-call arguments as an empty object', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_bad', arguments: '{' }),
        aResponsesFunctionCallOutput({ call_id: 'call_bad' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolUsesOf(value.messages)[0]?.input).toEqual({});
  });
});

describe('decodeRequest: consecutive tool results reach a strict target grouped', () => {
  it('folds consecutive tool results into a single user turn carrying each block', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_a', name: 'a' }),
        aResponsesFunctionCall({ call_id: 'call_b', name: 'b' }),
        aResponsesFunctionCallOutput({ call_id: 'call_a', output: 'ra' }),
        aResponsesFunctionCallOutput({ call_id: 'call_b', output: 'rb' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));
    const resultTurns = value.messages.filter(isToolResultTurn);

    expect(value.messages.map((message) => message.role)).toEqual([
      'assistant',
      'assistant',
      'user',
    ]);
    expect(resultTurns).toHaveLength(1);
    expect(resultTurns[0]?.content).toHaveLength(2);
  });
});

describe('decodeRequest: a request with no turn still reaches a valid target', () => {
  it('injects a fallback user turn when the input yields no hub message', () => {
    const request = aResponsesRequest({ instructions: 'be brief', input: [] });

    const { value } = expectTranslation(decodeRequest(request));

    expect(value.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: '' }] }]);
  });
});

describe('decodeRequest: a root schema union normalizes for a strict target', () => {
  it('drops a root anyOf union to an object with empty properties, merging no required', () => {
    const tool = aResponsesTool({
      parameters: {
        anyOf: [{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }],
      },
    });

    const { value } = expectTranslation(decodeRequest(aResponsesRequest({ tools: [tool] })));

    expect(value.tools?.[0]?.inputSchema).toEqual({ type: 'object', properties: {} });
  });
});

describe('decodeRequest: a tool result carries an image to the hub', () => {
  it('decodes a data-uri image output into an image tool_result block', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_img' }),
        aResponsesFunctionCallOutput({ call_id: 'call_img', output: 'data:image/png;base64,AAA' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolResultsOf(value.messages)[0]?.content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', mediaType: 'image/png', data: 'AAA' },
    });
  });

  it('keeps a plain text output as a text tool_result block', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_t' }),
        aResponsesFunctionCallOutput({ call_id: 'call_t', output: 'sunny, 21C' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolResultsOf(value.messages)[0]?.content[0]).toEqual({
      type: 'text',
      text: 'sunny, 21C',
    });
  });
});

describe('decodeRequest: a malformed data uri stays text rather than an image', () => {
  it('keeps a base64 marker that names another scheme as text, not an image', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_s' }),
        aResponsesFunctionCallOutput({ call_id: 'call_s', output: 'blob:image/png;base64,AAA' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolResultsOf(value.messages)[0]?.content[0]).toEqual({
      type: 'text',
      text: 'blob:image/png;base64,AAA',
    });
  });

  it('keeps a data-uri that names no base64 payload as text, not an image', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_u' }),
        aResponsesFunctionCallOutput({ call_id: 'call_u', output: 'data:image/png,AAA' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolResultsOf(value.messages)[0]?.content[0]).toEqual({
      type: 'text',
      text: 'data:image/png,AAA',
    });
  });

  it('keeps a base64 data-uri with an empty media type as text, not an image', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ call_id: 'call_e' }),
        aResponsesFunctionCallOutput({ call_id: 'call_e', output: 'data:;base64,AAA' }),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolResultsOf(value.messages)[0]?.content[0]).toEqual({
      type: 'text',
      text: 'data:;base64,AAA',
    });
  });
});

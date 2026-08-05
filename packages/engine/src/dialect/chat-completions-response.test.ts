import { describe, expect, it } from 'vitest';

import type { HubResponse } from './hub';
import type { HubToolUseBlock } from './hub';

import { decodeResponse, encodeResponse } from './chat-completions-response';
import { aChatResponse, aChatToolCall } from './chat-completions.testkit';
import {
  aHubRedactedThinkingBlock,
  aHubResponse,
  aHubTextBlock,
  aHubThinkingBlock,
  aHubToolUseBlock,
} from './hub.testkit';

function encodedValue(hub: HubResponse) {
  const result = encodeResponse(hub);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result;
}

function toolArgumentsOf(rawArguments: string): unknown {
  const response = aChatResponse({
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [aChatToolCall({ function: { name: 'x', arguments: rawArguments } })],
        },
        finish_reason: 'tool_calls',
      },
    ],
  });

  return decodeResponse(response).value.content.find(
    (block): block is HubToolUseBlock => block.type === 'tool_use',
  )?.input;
}

describe('the codec parses tool arguments across the json shapes', () => {
  it('reads a valid object, and falls back to an empty object otherwise', () => {
    expect(toolArgumentsOf('{"a":1}')).toEqual({ a: 1 });
    expect(toolArgumentsOf('')).toEqual({});
    expect(toolArgumentsOf('not json')).toEqual({});
    expect(toolArgumentsOf('[1,2]')).toEqual({});
    expect(toolArgumentsOf('42')).toEqual({});
    expect(toolArgumentsOf('null')).toEqual({});
  });
});

describe('the codec maps response usage exactly both ways', () => {
  it('decodes the full hub answer shape from a plain Chat Completions answer', () => {
    const { value } = decodeResponse(aChatResponse());

    expect(value).toEqual({
      content: [{ type: 'text', text: 'Sunny, 21C.' }],
      stopReason: 'end',
      usage: { inputTokens: 12, outputTokens: 8 },
    });
  });

  it('encodes the full Chat Completions answer shape from a plain hub answer', () => {
    const { value } = encodedValue(
      aHubResponse({
        content: [aHubTextBlock({ text: 'ok' })],
        usage: { inputTokens: 3, outputTokens: 4 },
      }),
    );

    expect(value).toEqual({
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 4 },
    });
  });
});

describe('decodeResponse folds a Chat Completions answer into the hub', () => {
  it('maps a tool-call answer, keeping the call, the stop reason, and the usage', () => {
    const response = aChatResponse({
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: null, tool_calls: [aChatToolCall()] },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 30, completion_tokens: 12 },
    });

    const { value } = decodeResponse(response);

    const toolUse = value.content.find(
      (block): block is HubToolUseBlock => block.type === 'tool_use',
    );

    expect(toolUse?.name).toBe('get_weather');
    expect(value.stopReason).toBe('tool_use');
    expect(value.usage).toEqual({ inputTokens: 30, outputTokens: 12 });
  });

  it('maps a plain stop to the hub end reason and carries the text', () => {
    const { value } = decodeResponse(aChatResponse());

    expect(value.stopReason).toBe('end');
    expect(value.content).toEqual([{ type: 'text', text: 'Sunny, 21C.' }]);
  });
});

describe('encodeResponse folds the hub answer back into Chat Completions', () => {
  it('maps the hub stop reasons to their Chat Completions counterparts', () => {
    expect(encodedValue(aHubResponse({ stopReason: 'end' })).value.choices[0]?.finish_reason).toBe(
      'stop',
    );
    expect(
      encodedValue(aHubResponse({ stopReason: 'max_output' })).value.choices[0]?.finish_reason,
    ).toBe('length');
    expect(
      encodedValue(aHubResponse({ stopReason: 'tool_use', content: [aHubToolUseBlock()] })).value
        .choices[0]?.finish_reason,
    ).toBe('tool_calls');
  });

  it('maps usage counts back to the Chat Completions token names', () => {
    const { value } = encodedValue(aHubResponse({ usage: { inputTokens: 9, outputTokens: 4 } }));

    expect(value.usage).toEqual({ prompt_tokens: 9, completion_tokens: 4 });
  });

  it('drops a thinking block from the answer with a cost-bearing fate', () => {
    const hub = aHubResponse({ content: [aHubThinkingBlock(), aHubTextBlock({ text: 'Sunny.' })] });

    const { value, fates } = encodedValue(hub);

    expect(JSON.stringify(value)).not.toContain('weigh the two routes');
    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'thinking', disposition: 'mapped', costBearing: true }),
    );
  });

  it('drops a redacted thinking block from the answer with a cost-bearing fate', () => {
    const hub = aHubResponse({
      content: [
        aHubRedactedThinkingBlock({ data: 'opaque-redacted-payload' }),
        aHubTextBlock({ text: 'Sunny.' }),
      ],
    });

    const { value, fates } = encodedValue(hub);

    expect(JSON.stringify(value)).not.toContain('opaque-redacted-payload');
    expect(fates).toContainEqual(
      expect.objectContaining({
        field: 'redacted_thinking',
        disposition: 'mapped',
        costBearing: true,
      }),
    );
  });

  it('lands a refusal at a documented finish reason with the lossy mapping recorded', () => {
    const { value, fates } = encodedValue(aHubResponse({ stopReason: 'refusal' }));

    expect(value.choices[0]?.finish_reason).toBe('content_filter');
    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'stopReason', disposition: 'mapped' }),
    );
  });
});

describe('encodeResponse refuses a stop reason the Chat Completions dialect cannot express', () => {
  it('refuses a paused turn typed rather than defaulting to a near match', () => {
    expect(encodeResponse(aHubResponse({ stopReason: 'paused' }))).toEqual({
      refusal: { reason: 'unmappable-stop-reason', stopReason: 'paused' },
    });
  });

  it('refuses a context overflow typed rather than truncating silently', () => {
    expect(encodeResponse(aHubResponse({ stopReason: 'context_overflow' }))).toEqual({
      refusal: { reason: 'unmappable-stop-reason', stopReason: 'context_overflow' },
    });
  });

  it('maps a stop sequence to the plain stop finish reason', () => {
    expect(
      encodedValue(aHubResponse({ stopReason: 'stop_sequence' })).value.choices[0]?.finish_reason,
    ).toBe('stop');
  });
});

describe('decodeResponse handles the sparser answers', () => {
  it('maps a content-filter finish to the hub refusal reason', () => {
    const response = aChatResponse({
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'no' },
          finish_reason: 'content_filter',
        },
      ],
    });

    expect(decodeResponse(response).value.stopReason).toBe('refusal');
  });

  it('maps a length finish to the hub max-output reason', () => {
    const response = aChatResponse({
      choices: [
        { index: 0, message: { role: 'assistant', content: 'x' }, finish_reason: 'length' },
      ],
    });

    expect(decodeResponse(response).value.stopReason).toBe('max_output');
  });

  it('answers empty content and an end reason when there is no choice or usage', () => {
    const { value } = decodeResponse({ choices: [] });

    expect(value.content).toEqual([]);
    expect(value.stopReason).toBe('end');
    expect(value.usage).toEqual({});
  });

  it('keeps both the text and the tool call from an answer that carries each', () => {
    const response = aChatResponse({
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'here', tool_calls: [aChatToolCall()] },
          finish_reason: 'tool_calls',
        },
      ],
    });

    expect(decodeResponse(response).value.content.map((block) => block.type)).toEqual([
      'text',
      'tool_use',
    ]);
  });
});

describe('encodeResponse counts the sparser answers', () => {
  it('reports zeroed usage when the hub answer counts none', () => {
    expect(encodedValue(aHubResponse({ usage: {} })).value.usage).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
    });
  });

  it('parses invalid tool arguments to an empty object rather than throwing', () => {
    const response = aChatResponse({
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [aChatToolCall({ function: { name: 'x', arguments: 'not json' } })],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });

    const toolUse = decodeResponse(response).value.content.find(
      (block): block is HubToolUseBlock => block.type === 'tool_use',
    );

    expect(toolUse?.input).toEqual({});
  });
});

describe('decodeResponse accounts for discarded extra choices', () => {
  it('keeps the first choice and records a cost-bearing drop fate for the rest', () => {
    const response = aChatResponse({
      choices: [
        { index: 0, message: { role: 'assistant', content: 'a' }, finish_reason: 'stop' },
        { index: 1, message: { role: 'assistant', content: 'b' }, finish_reason: 'stop' },
      ],
    });

    const { value, fates } = decodeResponse(response);

    expect(value.content).toEqual([{ type: 'text', text: 'a' }]);
    expect(fates).toContainEqual({
      field: 'choices[extra]',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

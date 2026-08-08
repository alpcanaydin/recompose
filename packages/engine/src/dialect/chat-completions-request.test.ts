import { describe, expect, it } from 'vitest';

import type { HubToolResultBlock, HubToolUseBlock } from './hub';

import { decodeRequest, injectedMaxOutputTokensDefault } from './chat-completions-request';
import {
  aChatAssistantMessage,
  aChatDeveloperMessage,
  aChatRequest,
  aChatSystemMessage,
  aChatTool,
  aChatToolCall,
  aChatToolMessage,
  aChatUserMessage,
} from './chat-completions.testkit';
import { accountForEveryKey } from './fates';

function decodedValue(request: Parameters<typeof decodeRequest>[0]) {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result;
}

describe('decodeRequest folds a Chat Completions request into the hub', () => {
  it('keeps the tools, the tool choice, and the system prompt through the crossing', () => {
    const request = aChatRequest({
      messages: [aChatSystemMessage(), aChatUserMessage()],
      tools: [aChatTool()],
      tool_choice: { type: 'function', function: { name: 'get_weather' } },
    });

    const { value } = decodedValue(request);

    expect(value.system).toEqual([{ text: 'You answer concisely.' }]);
    expect(value.tools).toHaveLength(1);
    expect(value.toolChoice).toEqual({ type: 'tool', name: 'get_weather' });
    expect(value.messages.map((message) => message.role)).toEqual(['user']);
  });

  it('normalizes a bare object tool schema to an explicit empty properties object', () => {
    const request = aChatRequest({
      tools: [
        aChatTool({ type: 'function', function: { name: 'ping', parameters: { type: 'object' } } }),
      ],
    });

    const { value } = decodedValue(request);

    expect(value.tools?.[0]?.inputSchema).toEqual({ type: 'object', properties: {} });
  });

  it('preserves system and developer messages as ordered system blocks', () => {
    const request = aChatRequest({
      messages: [
        aChatSystemMessage({ content: 'Be concise' }),
        aChatDeveloperMessage({ content: 'Answer in English' }),
        aChatUserMessage(),
      ],
    });

    const { value } = decodedValue(request);

    expect(value.system).toEqual([{ text: 'Be concise' }, { text: 'Answer in English' }]);
  });
});

describe('decodeRequest drops an empty text block from a Chat Completions turn', () => {
  it('drops an empty text block rather than forwarding it, recording a fate', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage({
          content: [
            { type: 'text', text: '' },
            { type: 'text', text: 'still here' },
          ],
        }),
      ],
    });

    const { value, fates } = decodedValue(request);

    expect(value.messages.flatMap((message) => message.content)).toEqual([
      { type: 'text', text: 'still here' },
    ]);
    expect(fates).toContainEqual(expect.objectContaining({ disposition: 'mapped', to: 'absent' }));
  });
});

describe('decodeRequest injects the documented sampling repairs', () => {
  it('injects a documented, visible token ceiling when the request names none', () => {
    const request = aChatRequest();

    const { value, fates } = decodedValue(request);

    expect(value.sampling?.maxOutputTokens).toBe(injectedMaxOutputTokensDefault);
    expect(fates).toContainEqual(
      expect.objectContaining({
        field: 'max_tokens',
        disposition: 'mapped',
        to: 'sampling.maxOutputTokens (default)',
      }),
    );
  });

  it('clamps a temperature above the Anthropic ceiling down to one', () => {
    const request = aChatRequest({ temperature: 1.7 });

    const { value, fates } = decodedValue(request);

    expect(value.sampling?.temperature).toBe(1);
    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'temperature', disposition: 'mapped' }),
    );
  });
});

describe('decodeRequest accounts for every source field', () => {
  it('drops a vendor-ignored field, recording a mapped-to-absent fate', () => {
    const request = aChatRequest({ seed: 7 });

    const { fates } = decodedValue(request);

    expect(fates).toContainEqual({ field: 'seed', disposition: 'mapped', to: 'absent' });
  });

  it('names every top-level source field with a fate, so nothing vanishes untraced', () => {
    const request = aChatRequest({
      messages: [aChatSystemMessage(), aChatUserMessage()],
      tools: [aChatTool()],
      tool_choice: 'auto',
      temperature: 0.4,
      top_p: 0.9,
      stop: ['\n\n'],
      max_tokens: 512,
      seed: 3,
    });

    const { fates } = decodedValue(request);

    expect(accountForEveryKey(Object.keys(request), fates)).toEqual([]);
  });
});

describe('decodeRequest maps structured content and the plainer turns', () => {
  it('maps an array of user content parts into hub text and image blocks', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage({
          content: [
            { type: 'text', text: 'look' },
            { type: 'image_url', image_url: { url: 'https://x.test/p.png' } },
          ],
        }),
      ],
    });

    const kinds = decodedValue(request)
      .value.messages.flatMap((message) => message.content)
      .map((block) => block.type);

    expect(kinds).toEqual(['text', 'image']);
  });

  it('keeps a plain assistant text turn that carries no tool call', () => {
    const request = aChatRequest({ messages: [{ role: 'assistant', content: 'just text' }] });

    expect(decodedValue(request).value.messages.flatMap((message) => message.content)).toEqual([
      { type: 'text', text: 'just text' },
    ]);
  });

  it('keeps both the text and the answered tool call from one assistant turn', () => {
    const request = aChatRequest({
      messages: [
        aChatAssistantMessage({
          content: 'thinking out loud',
          tool_calls: [aChatToolCall({ id: 'call_z' })],
        }),
        aChatToolMessage({ tool_call_id: 'call_z' }),
      ],
    });

    const kinds = decodedValue(request)
      .value.messages.flatMap((message) => message.content)
      .map((block) => block.type);

    expect(kinds).toContain('text');
    expect(kinds).toContain('tool_use');
  });
});

describe('decodeRequest repairs a loose tool history or refuses when it cannot', () => {
  it('repairs a dangling tool call by dropping it and naming the repair as its fate', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage(),
        aChatAssistantMessage({ tool_calls: [aChatToolCall({ id: 'call_orphan' })] }),
      ],
    });

    const { value, fates } = decodedValue(request);

    const toolUses = value.messages
      .flatMap((message) => message.content)
      .filter((block): block is HubToolUseBlock => block.type === 'tool_use');

    expect(toolUses).toHaveLength(0);
    expect(fates).toContainEqual(
      expect.objectContaining({ field: 'call_orphan', disposition: 'mapped', to: 'absent' }),
    );
  });

  it('refuses typed when a tool result answers a call the history never made, naming the id', () => {
    const request = aChatRequest({
      messages: [aChatUserMessage(), aChatToolMessage({ tool_call_id: 'call_ghost' })],
    });

    const result = decodeRequest(request);

    expect(result).toEqual({
      refusal: { reason: 'unrepairable-tool-call', unmatchedId: 'call_ghost' },
    });
  });

  it('keeps a tool call its tool result answers, pairing the ids through the hub', () => {
    const request = aChatRequest({
      messages: [
        aChatUserMessage(),
        aChatAssistantMessage({ tool_calls: [aChatToolCall({ id: 'call_kept' })] }),
        aChatToolMessage({ tool_call_id: 'call_kept' }),
      ],
    });

    const { value } = decodedValue(request);

    const use = value.messages
      .flatMap((message) => message.content)
      .find((block): block is HubToolUseBlock => block.type === 'tool_use');
    const answer = value.messages
      .flatMap((message) => message.content)
      .find((block): block is HubToolResultBlock => block.type === 'tool_result');

    expect(use?.id).toBe('call_kept');
    expect(answer?.toolUseId).toBe('call_kept');
  });
});

describe('decodeRequest carries the sampling and tool-choice fields into the hub', () => {
  it('carries top_p and a single stop string into the hub sampling', () => {
    const { value } = decodedValue(aChatRequest({ top_p: 0.8, stop: 'END' }));

    expect(value.sampling?.topP).toBe(0.8);
    expect(value.sampling?.stop).toEqual(['END']);
  });

  it('maps each string tool choice to its hub form', () => {
    expect(decodedValue(aChatRequest({ tool_choice: 'auto' })).value.toolChoice).toEqual({
      type: 'auto',
    });
    expect(decodedValue(aChatRequest({ tool_choice: 'none' })).value.toolChoice).toEqual({
      type: 'none',
    });
    expect(decodedValue(aChatRequest({ tool_choice: 'required' })).value.toolChoice).toEqual({
      type: 'required',
    });
  });

  it('builds the exact hub sampling from the source knobs', () => {
    const { value } = decodedValue(
      aChatRequest({ max_tokens: 512, temperature: 0.5, top_p: 0.9, stop: 'x' }),
    );

    expect(value.sampling).toEqual({
      maxOutputTokens: 512,
      temperature: 0.5,
      topP: 0.9,
      stop: ['x'],
    });
  });

  it('normalizes a stop array without rewrapping it', () => {
    expect(decodedValue(aChatRequest({ stop: ['a', 'b'] })).value.sampling?.stop).toEqual([
      'a',
      'b',
    ]);
  });

  it('leaves the hub sampling holding only the injected ceiling when no knob is named', () => {
    expect(decodedValue(aChatRequest()).value.sampling).toEqual({
      maxOutputTokens: injectedMaxOutputTokensDefault,
    });
  });
});

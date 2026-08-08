import { describe, expect, it } from 'vitest';

import type { RequestOf } from './dispatcher';

import { translateRequest } from './dispatcher';

function translated(body: RequestOf['responses']) {
  const result = translateRequest('responses', 'chat-completions', body);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected Chat request');

  return result.value;
}

function call(id = 'call_1') {
  return { type: 'function_call' as const, call_id: id, name: 'run_command', arguments: '{}' };
}

function output(value: unknown, id = 'call_1') {
  return { type: 'function_call_output' as const, call_id: id, output: value };
}

function reasoning(text?: string) {
  return {
    type: 'reasoning' as const,
    summary: text === undefined ? [] : [{ type: 'summary_text' as const, text }],
  };
}

describe('Responses tool-output image residual parity', () => {
  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_UnwrapsStringifiedToolOutputImages', () => {
    const value = translated({
      input: [
        call(),
        output(
          JSON.stringify([
            { type: 'input_text', text: 'result' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.test/image.png', detail: 'original' },
            },
          ]),
        ),
      ],
    });

    expect(value).toHaveProperty(
      'messages.1.content.1.image_url.url',
      'https://example.test/image.png',
    );
    expect(value).toHaveProperty('messages.1.content.1.image_url.detail', 'high');
  });

  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_ConvertsStructuredToolOutputImages', () => {
    const value = translated({
      input: [
        call(),
        output([
          { type: 'input_text', text: 'result' },
          { type: 'input_image', image_url: 'data:image/png;base64,AA==', detail: 'original' },
        ]),
      ],
    });

    expect(value).toHaveProperty('messages.1.content.1.image_url.detail', 'high');
  });
});

describe('Responses unsigned reasoning residual parity', () => {
  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_AttachesReasoningToAssistantMessage', () => {
    const value = translated({
      input: [
        reasoning('first line\n'),
        reasoning('second line'),
        { type: 'message', role: 'assistant', content: 'answer' },
      ],
    });

    expect(value).toHaveProperty('messages.0.reasoning_content', 'first line\nsecond line');
    expect(value).toHaveProperty('messages.0.content', 'answer');
  });

  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_AttachesReasoningToToolCallMessage', () => {
    const value = translated({ input: [reasoning('tool reasoning'), call(), output('ok')] });

    expect(value).toHaveProperty('messages.0.reasoning_content', 'tool reasoning');
    expect(value).toHaveProperty('messages.0.tool_calls.0.function.name', 'run_command');
  });

  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_KeepsReasoningBeforeUserMessage', () => {
    const value = translated({
      input: [reasoning(), { type: 'message', role: 'user', content: 'next' }],
    });

    expect(value).toHaveProperty('messages.0.role', 'assistant');
    expect(value).toHaveProperty('messages.0.reasoning_content', '[reasoning unavailable]');
    expect(value).toHaveProperty('messages.1.role', 'user');
  });
});

describe('Responses tool-setting residual parity', () => {
  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_PreservesStructuredToolChoice', () => {
    const value = translated({
      input: [{ type: 'message', role: 'user', content: 'run' }],
      tools: [{ type: 'function', name: 'run_command', parameters: {} }],
      tool_choice: { type: 'function', function: { name: 'run_command' } },
    });

    expect(value).toHaveProperty('tool_choice.function.name', 'run_command');
  });

  it('TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_OmitsToolSettingsWithoutTools', () => {
    const value = translated({
      input: [{ type: 'message', role: 'user', content: 'hello' }],
      tools: [],
      tool_choice: 'required',
      parallel_tool_calls: false,
    });

    expect(value).not.toHaveProperty('tools');
    expect(value).not.toHaveProperty('tool_choice');
    expect(value).not.toHaveProperty('parallel_tool_calls');
  });
});

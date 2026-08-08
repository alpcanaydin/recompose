import { describe, expect, it } from 'vitest';

import type { ChatToolMessage } from './chat-completions-wire';
import type { RequestOf } from './dispatcher';
import type { ResponsesFunctionCallOutputItem, ResponsesResponse } from './responses-wire';

import { translateRequest, translateResponse } from './dispatcher';

describe('Chat tool output media crossing Codex Responses', () => {
  it('should preserve structured text, image, and file output parts', () => {
    const output = translatedToolOutput([
      { type: 'text', text: 'Rendered result attached.' },
      {
        type: 'image_url',
        image_url: { url: 'https://example.test/generated.png', detail: 'high' },
      },
      { type: 'image_url', image_url: { file_id: 'file-img-123' } },
      { type: 'file', file: { file_id: 'file-doc-123', filename: 'doc.pdf' } },
      { type: 'file', file: { file_data: 'SGVsbG8=', filename: 'inline.txt' } },
      {
        type: 'file',
        file: { file_url: 'https://example.test/report.pdf', filename: 'report.pdf' },
      },
    ]);

    expect(output).toEqual(structuredOutputExpectation());
  });

  it('should unwrap stringified Codex and Chat image output arrays', () => {
    const codex = translatedToolOutput(
      '[{"type":"input_text","text":"Captured."},{"type":"input_image","image_url":"data:image/png;base64,AA==","detail":"original"}]',
    );
    const chat = translatedToolOutput(
      '[{"type":"image_url","image_url":{"url":"https://example.test/image.png","detail":"high"}}]',
    );

    expect(codex).toEqual([
      { type: 'input_text', text: 'Captured.' },
      { type: 'input_image', image_url: 'data:image/png;base64,AA==', detail: 'original' },
    ]);
    expect(chat).toEqual([
      { type: 'input_image', image_url: 'https://example.test/image.png', detail: 'high' },
    ]);
  });

  it('should preserve invalid structured parts as separate text fallbacks', () => {
    const output = translatedToolOutput([
      { type: 'image_url', image_url: { detail: 'low' } },
      { type: 'file', file: { filename: 'orphan.txt' } },
      { type: 'unknown_type', nested: { a: 1 } },
    ]);

    expect(output).toEqual([
      { type: 'input_text', text: '{"type":"image_url","image_url":{"detail":"low"}}' },
      { type: 'input_text', text: '{"type":"file","file":{"filename":"orphan.txt"}}' },
      { type: 'input_text', text: '{"type":"unknown_type","nested":{"a":1}}' },
    ]);
  });

  it('should stringify non-string JSON tool output', () => {
    expect(translatedToolOutput(null)).toBe('null');
    expect(translatedToolOutput({ status: 'ok', count: 2 })).toBe('{"status":"ok","count":2}');
  });
});

describe('Codex generated images crossing Chat Completions non-stream', () => {
  it('should add generated images to the assistant message', () => {
    const response: ResponsesResponse = {
      id: 'resp_image',
      model: 'gpt-5.4',
      status: 'completed',
      output: [{ type: 'image_generation_call', output_format: 'png', result: 'aGVsbG8=' }],
    };
    const translated = translateResponse('responses', 'chat-completions', response);

    if ('outcome' in translated || 'refusal' in translated) throw new Error('expected response');

    expect(translated.value.choices[0]?.message).toEqual({
      role: 'assistant',
      content: null,
      images: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } }],
    });
  });
});

// Helpers

function translatedToolOutput(content: ChatToolMessage['content']): unknown {
  const body: RequestOf['chat-completions'] = {
    messages: [
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_output',
            type: 'function',
            function: { name: 'render_output', arguments: '{}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_output', content },
    ],
  };
  const translated = translateRequest('chat-completions', 'responses', body);

  if ('outcome' in translated || 'refusal' in translated) throw new Error('expected request');

  return functionOutput(translated.value.input);
}

function structuredOutputExpectation(): readonly Record<string, unknown>[] {
  return [
    { type: 'input_text', text: 'Rendered result attached.' },
    { type: 'input_image', image_url: 'https://example.test/generated.png', detail: 'high' },
    { type: 'input_image', file_id: 'file-img-123' },
    { type: 'input_file', file_id: 'file-doc-123', filename: 'doc.pdf' },
    { type: 'input_file', file_data: 'SGVsbG8=', filename: 'inline.txt' },
    {
      type: 'input_file',
      file_url: 'https://example.test/report.pdf',
      filename: 'report.pdf',
    },
  ];
}

function functionOutput(
  input: RequestOf['responses']['input'],
): ResponsesFunctionCallOutputItem['output'] {
  const item = input.find(
    (candidate): candidate is ResponsesFunctionCallOutputItem =>
      candidate.type === 'function_call_output',
  );

  if (item === undefined) throw new Error('expected function output');

  return item.output;
}

import { describe, expect, it } from 'vitest';

import type { RequestOf } from './dispatcher';

import { translateRequest } from './dispatcher';

describe('Responses function history crossing Chat Completions', () => {
  it('should merge consecutive function calls and keep ordered outputs', () => {
    const value = translated({
      input: [call('exec:0'), call('exec:1'), output('exec:0', 'ok0'), output('exec:1', 'ok1')],
    });

    expect(value.messages).toHaveLength(3);
    expect(value.messages[0]).toHaveProperty('tool_calls.length', 2);
    expect(value.messages[1]).toHaveProperty('tool_call_id', 'exec:0');
    expect(value.messages[2]).toHaveProperty('tool_call_id', 'exec:1');
  });

  it('should split function calls interrupted by a user message', () => {
    const value = translated({
      input: [call('call_a'), message('user', 'next'), call('call_b')],
    });

    expect(value.messages.map((entry) => entry.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(value.messages[0]).toHaveProperty('tool_calls.0.id', 'call_a');
    expect(value.messages[2]).toHaveProperty('tool_calls.0.id', 'call_b');
  });

  it('should move a tool output directly behind its call without losing user messages', () => {
    const value = translated({
      input: [
        call('call_x'),
        message('user', 'Approved command prefix saved'),
        output('call_x', 'ok'),
        message('user', 'next'),
      ],
    });

    expect(value.messages.map((entry) => entry.role)).toEqual([
      'assistant',
      'tool',
      'user',
      'user',
    ]);
    expect(value.messages[1]).toHaveProperty('tool_call_id', 'call_x');
    expect(value.messages[2]).toHaveProperty('content', 'Approved command prefix saved');
  });
});

describe('Responses tool outputs crossing Chat Completions', () => {
  it('should unwrap stringified and structured image outputs', () => {
    const stringified = translated({
      input: [
        call('call_1'),
        output(
          'call_1',
          JSON.stringify([
            { type: 'input_text', text: 'image' },
            { type: 'input_image', image_url: 'data:image/png;base64,AAAA' },
          ]),
        ),
      ],
    });
    const structured = translated({
      input: [
        call('call_2'),
        output('call_2', [
          { type: 'input_text', text: 'image' },
          { type: 'input_image', image_url: 'https://example.test/image.png' },
        ]),
      ],
    });

    expect(stringified.messages[1]).toHaveProperty(
      'content.1.image_url.url',
      'data:image/png;base64,AAAA',
    );
    expect(structured.messages[1]).toHaveProperty(
      'content.1.image_url.url',
      'https://example.test/image.png',
    );
  });

  it('should keep non-image tool-output strings unchanged', () => {
    const value = translated({ input: [call('call_1'), output('call_1', '{"ok":true}')] });

    expect(value.messages[1]).toHaveProperty('content', '{"ok":true}');
  });
});

describe('Responses reasoning crossing Chat Completions', () => {
  it('should attach reasoning to following assistant text and tool calls', () => {
    const signature = gptSignature();
    const text = translated({
      input: [reasoning(signature, 'think'), message('assistant', 'answer')],
    });
    const tool = translated({
      input: [reasoning(signature, 'think'), call('call_1'), output('call_1', 'ok')],
    });

    expect(text.messages[0]).toHaveProperty('reasoning_content', 'think');
    expect(text.messages[0]).toHaveProperty('content', 'answer');
    expect(tool.messages[0]).toHaveProperty('reasoning_content', 'think');
    expect(tool.messages[0]).toHaveProperty('tool_calls.0.id', 'call_1');
  });

  it('should keep reasoning before an ordinary user message', () => {
    const value = translated({
      input: [reasoning(gptSignature(), 'think'), message('user', 'next')],
    });

    expect(value.messages.map((entry) => entry.role)).toEqual(['assistant', 'user']);
    expect(value.messages[0]).toHaveProperty('reasoning_content', 'think');
  });
});

describe('Responses tools and output format crossing Chat Completions', () => {
  it('should flatten namespace tools and qualify history and tool choice', () => {
    const value = translated({
      tools: [
        {
          type: 'namespace',
          name: 'mcp',
          tools: [{ type: 'function', name: 'run', parameters: { type: 'object' } }],
        },
      ],
      tool_choice: { type: 'function', name: 'run', namespace: 'mcp' },
      input: [
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'run',
          namespace: 'mcp',
          arguments: '{}',
        },
        output('call_1', 'ok'),
      ],
    });

    expect(value).toHaveProperty('tools.0.function.name', 'mcp__run');
    expect(value).toHaveProperty('messages.0.tool_calls.0.function.name', 'mcp__run');
    expect(value).toHaveProperty('tool_choice.function.name', 'mcp__run');
  });
});

describe('Responses tool settings crossing Chat Completions', () => {
  it('should omit tool settings without tools and preserve parallel mode with tools', () => {
    const without = translated({
      input: [message('user', 'hi')],
      tool_choice: 'required',
      parallel_tool_calls: false,
    });
    const withTools = translated({
      input: [message('user', 'hi')],
      tools: [{ type: 'function', name: 'run', parameters: { type: 'object' } }],
      parallel_tool_calls: false,
    });

    expect(without.tool_choice).toBeUndefined();
    expect(without.parallel_tool_calls).toBeUndefined();
    expect(withTools.parallel_tool_calls).toBe(false);
  });

  it('should preserve text JSON formats and normalize input image detail', () => {
    const format = translated({
      input: [message('user', 'hi')],
      text: {
        format: {
          type: 'json_schema',
          name: 'answer',
          strict: true,
          schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      },
    });
    const image = translated({
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: 'https://example.test/image.png',
              detail: 'original',
            },
          ],
        },
      ],
    });

    expect(format).toHaveProperty('response_format.json_schema.name', 'answer');
    expect(image).toHaveProperty('messages.0.content.0.image_url.detail', 'high');
  });
});

function translated(body: RequestOf['responses']) {
  const result = translateRequest('responses', 'chat-completions', body);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected Chat request');

  return result.value;
}

function call(id: string) {
  return { type: 'function_call' as const, call_id: id, name: 'exec', arguments: '{}' };
}

function output(id: string, value: unknown) {
  return { type: 'function_call_output' as const, call_id: id, output: value };
}

function message(role: 'user' | 'assistant', content: string) {
  return { type: 'message' as const, role, content };
}

function reasoning(signature: string, text: string) {
  return {
    type: 'reasoning' as const,
    encrypted_content: signature,
    summary: [{ type: 'summary_text' as const, text }],
  };
}

function gptSignature(): string {
  const raw = Buffer.alloc(73);

  raw[0] = 0x80;
  raw[8] = 1;

  return raw.toString('base64url');
}

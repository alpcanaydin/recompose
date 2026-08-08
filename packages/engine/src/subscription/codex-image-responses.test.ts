import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { codexImageResponsesBody } from './codex-image-responses';

function tool(body: JsonObject, action: 'generate' | 'edit' = 'generate'): JsonObject {
  const tools = codexImageResponsesBody(body, 'gpt-image-2', action)['tools'];

  return Array.isArray(tools) && isRecord(tools[0]) ? tools[0] : {};
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function content(body: JsonObject): unknown {
  const input = codexImageResponsesBody(body, 'gpt-image-2', 'generate')['input'];

  return Array.isArray(input) && isRecord(input[0]) ? input[0]['content'] : undefined;
}

describe('a Codex image request states the generation tool', () => {
  test('the requested model reaches the responses body', () => {
    const request = codexImageResponsesBody(
      { prompt: 'a gateway' },
      'gpt-image-2-mini',
      'generate',
    );

    expect(request['model']).toBe('gpt-image-2-mini');
  });

  test('the action the caller asked for reaches the tool', () => {
    expect(tool({ prompt: 'a gateway' }, 'edit')['action']).toBe('edit');
  });

  test('a request without options states only the tool identity', () => {
    expect(tool({ prompt: 'a gateway' })).toEqual({
      type: 'image_generation',
      action: 'generate',
      model: 'gpt-image-2',
    });
  });

  test('every stated string option is copied to the tool', () => {
    const stated = tool({
      prompt: 'a gateway',
      size: '1024x1024',
      quality: 'high',
      background: 'transparent',
      output_format: 'png',
      input_fidelity: 'high',
      moderation: 'low',
    });

    expect(stated['size']).toBe('1024x1024');
    expect(stated['moderation']).toBe('low');
    expect(stated['input_fidelity']).toBe('high');
  });

  test('every stated number option is copied to the tool', () => {
    const stated = tool({ prompt: 'a gateway', output_compression: 80, partial_images: 3 });

    expect(stated['output_compression']).toBe(80);
    expect(stated['partial_images']).toBe(3);
  });
});

describe('a Codex image request carries the mask only when one was given', () => {
  test('a stated mask reaches the tool', () => {
    const stated = tool({ prompt: 'a gateway', mask: { image_url: 'https://example.test/m.png' } });

    expect(stated['input_image_mask']).toEqual({ image_url: 'https://example.test/m.png' });
  });

  test('a mask that is not an object is left out', () => {
    expect(tool({ prompt: 'a gateway', mask: 'https://example.test/m.png' })).not.toHaveProperty(
      'input_image_mask',
    );
  });

  test('a blank mask URL is left out', () => {
    expect(tool({ prompt: 'a gateway', mask: { image_url: '  ' } })).not.toHaveProperty(
      'input_image_mask',
    );
  });

  test('a mask without a URL is left out', () => {
    expect(tool({ prompt: 'a gateway', mask: {} })).not.toHaveProperty('input_image_mask');
  });
});

describe('a Codex image request carries the prompt and its reference images', () => {
  test('the prompt travels trimmed as the first input part', () => {
    expect(content({ prompt: '  a gateway  ' })).toEqual([
      { type: 'input_text', text: 'a gateway' },
    ]);
  });

  test('a missing prompt becomes an empty text part', () => {
    expect(content({})).toEqual([{ type: 'input_text', text: '' }]);
  });

  test('a prompt that is not a string becomes an empty text part', () => {
    expect(content({ prompt: 42 })).toEqual([{ type: 'input_text', text: '' }]);
  });

  test('each reference image follows the prompt', () => {
    const images = [
      { image_url: 'https://example.test/a.png' },
      { image_url: 'https://example.test/b.png' },
    ];

    expect(content({ prompt: 'a gateway', images })).toEqual([
      { type: 'input_text', text: 'a gateway' },
      { type: 'input_image', image_url: 'https://example.test/a.png' },
      { type: 'input_image', image_url: 'https://example.test/b.png' },
    ]);
  });

  test('an images field that is not a list contributes nothing', () => {
    expect(content({ prompt: 'a gateway', images: 'https://example.test/a.png' })).toEqual([
      { type: 'input_text', text: 'a gateway' },
    ]);
  });

  test('an entry that is not an object contributes nothing', () => {
    expect(content({ prompt: 'a gateway', images: ['https://example.test/a.png'] })).toEqual([
      { type: 'input_text', text: 'a gateway' },
    ]);
  });

  test('an entry with a blank URL contributes nothing', () => {
    expect(content({ prompt: 'a gateway', images: [{ image_url: '   ' }] })).toEqual([
      { type: 'input_text', text: 'a gateway' },
    ]);
  });

  test('an entry with a non-string URL contributes nothing', () => {
    expect(content({ prompt: 'a gateway', images: [{ image_url: 7 }] })).toEqual([
      { type: 'input_text', text: 'a gateway' },
    ]);
  });
});

import { describe, expect, test } from 'vitest';

import type { ResponsesFunctionCallOutputItem } from './responses-wire';

import { toolResultBlockOf } from './responses-tool-result';

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function output(value: unknown): ResponsesFunctionCallOutputItem {
  return { type: 'function_call_output', call_id: 'call_1', output: value };
}

describe('a Responses tool result names the call it answers', () => {
  test('the tool use identifier is carried across', () => {
    expect(toolResultBlockOf(output('done')).toolUseId).toBe('call_1');
  });

  test('the stated tool name wins over the inferred one', () => {
    const item: ResponsesFunctionCallOutputItem = {
      type: 'function_call_output',
      call_id: 'call_1',
      name: 'Bash',
      output: 'done',
    };

    expect(toolResultBlockOf(item, 'Read').name).toBe('Bash');
  });

  test('an unnamed result borrows the inferred name', () => {
    expect(toolResultBlockOf(output('done'), 'Read').name).toBe('Read');
  });

  test('a result with no name at all carries none', () => {
    expect(toolResultBlockOf(output('done'))).not.toHaveProperty('name');
  });

  test('a text output claims no structured result', () => {
    expect(toolResultBlockOf(output('done'))).not.toHaveProperty('structuredResult');
  });

  test('a non-text output is kept as a structured result', () => {
    expect(toolResultBlockOf(output({ exitCode: 0 })).structuredResult).toEqual({ exitCode: 0 });
  });
});

describe('a Responses tool result reads whatever shape the output took', () => {
  test('a plain string becomes one text block', () => {
    expect(toolResultBlockOf(output('done')).content).toEqual([{ type: 'text', text: 'done' }]);
  });

  test('an absent output becomes an empty text block', () => {
    expect(toolResultBlockOf(output(undefined)).content).toEqual([{ type: 'text', text: '' }]);
  });

  test('an object output is serialized into text', () => {
    expect(toolResultBlockOf(output({ ok: true })).content).toEqual([
      { type: 'text', text: '{"ok":true}' },
    ]);
  });

  test('a data URI string becomes an inline image', () => {
    expect(toolResultBlockOf(output(PIXEL)).content[0]).toHaveProperty('type', 'image');
  });

  test('a list of parts is read part by part', () => {
    const parts = [
      { type: 'input_text', text: 'first' },
      { type: 'output_text', text: 'second' },
    ];

    expect(toolResultBlockOf(output(parts)).content).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
  });

  test('a part that is not an object falls back to its text', () => {
    expect(toolResultBlockOf(output(['plain'])).content).toEqual([{ type: 'text', text: 'plain' }]);
  });

  test('a text part without text falls back to serialization', () => {
    const content = toolResultBlockOf(output([{ type: 'input_text' }])).content;

    expect(content).toEqual([{ type: 'text', text: '{"type":"input_text"}' }]);
  });
});

describe('a Responses tool result carries the images the tool produced', () => {
  test('an input image addressed by URL is carried', () => {
    const parts = [{ type: 'input_image', image_url: 'https://example.test/a.png' }];

    expect(toolResultBlockOf(output(parts)).content).toEqual([
      { type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } },
    ]);
  });

  test('an input image given as a data URI is carried inline', () => {
    const parts = [{ type: 'input_image', image_url: PIXEL }];

    expect(toolResultBlockOf(output(parts)).content[0]).toHaveProperty('source.type', 'base64');
  });

  test('the stated detail travels with the image', () => {
    const parts = [{ type: 'input_image', image_url: 'https://example.test/a.png', detail: 'low' }];

    expect(toolResultBlockOf(output(parts)).content[0]).toHaveProperty('detail', 'low');
  });

  test('an original detail is carried as high', () => {
    const parts = [
      { type: 'input_image', image_url: 'https://example.test/a.png', detail: 'original' },
    ];

    expect(toolResultBlockOf(output(parts)).content[0]).toHaveProperty('detail', 'high');
  });

  test('a detail that is not a word is left out', () => {
    const parts = [{ type: 'input_image', image_url: 'https://example.test/a.png', detail: 7 }];

    expect(toolResultBlockOf(output(parts)).content[0]).not.toHaveProperty('detail');
  });

  test('an image in the legacy nested spelling is carried', () => {
    const parts = [{ type: 'image_url', image_url: { url: 'https://example.test/a.png' } }];

    expect(toolResultBlockOf(output(parts)).content).toEqual([
      { type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } },
    ]);
  });

  test('a legacy image without a URL is not an image', () => {
    const parts = [{ type: 'image_url', image_url: {} }];

    expect(toolResultBlockOf(output(parts)).content[0]).toHaveProperty('type', 'text');
  });
});

describe('a Responses tool result reads images out of a serialized output', () => {
  test('a JSON string holding image parts is read as parts', () => {
    const text = JSON.stringify([{ type: 'input_image', image_url: 'https://example.test/a.png' }]);

    expect(toolResultBlockOf(output(text)).content[0]).toHaveProperty('type', 'image');
  });

  test('a JSON string holding one image object is read as a part', () => {
    const text = JSON.stringify({ type: 'input_image', image_url: 'https://example.test/a.png' });

    expect(toolResultBlockOf(output(text)).content[0]).toHaveProperty('type', 'image');
  });

  test('a JSON string holding no image stays plain text', () => {
    const text = JSON.stringify([{ type: 'input_text', text: 'first' }]);

    expect(toolResultBlockOf(output(text)).content).toEqual([{ type: 'text', text }]);
  });

  test('a string that is not JSON stays plain text', () => {
    expect(toolResultBlockOf(output('not json')).content).toEqual([
      { type: 'text', text: 'not json' },
    ]);
  });
});

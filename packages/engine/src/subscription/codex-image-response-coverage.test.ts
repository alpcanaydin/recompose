import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { codexImageStreamResponse } from './codex-image-response';

function sseAnswer(events: readonly JsonObject[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

async function emittedEvents(answer: Response): Promise<JsonObject[]> {
  const text = await answer.text();

  return text.split('\n\n').flatMap((chunk) => {
    const line = chunk.split('\n').find((part) => part.startsWith('data: '));
    const parsed = line === undefined ? undefined : parsedJson(line.slice('data: '.length));

    return isJsonObject(parsed) ? [parsed] : [];
  });
}

function imageItem(result: string, format: string): JsonObject {
  return {
    type: 'image_generation_call',
    result,
    revised_prompt: 'a cat wearing a hat',
    output_format: format,
    size: '1024x1024',
    background: 'opaque',
    quality: 'high',
  };
}

describe('a Codex image stream the gateway cannot read', () => {
  it('should pass an upstream failure straight through', () => {
    const upstream = new Response('rate limited', { status: 429 });

    expect(codexImageStreamResponse(upstream, 'image_generation', 'b64_json')).toBe(upstream);
  });

  it('should pass an upstream answer that carries no body straight through', () => {
    const upstream = new Response(null, { status: 200 });

    expect(codexImageStreamResponse(upstream, 'image_generation', 'b64_json')).toBe(upstream);
  });
});

describe('partial images arriving on a Codex image stream', () => {
  it('should relay the partial bytes under the caller prefix', async () => {
    const upstream = sseAnswer([
      {
        type: 'response.image_generation_call.partial_image',
        partial_image_b64: 'QUFB',
        partial_image_index: 2,
        output_format: 'jpeg',
      },
    ]);

    await expect(
      emittedEvents(codexImageStreamResponse(upstream, 'image_generation', 'b64_json')),
    ).resolves.toEqual([
      { type: 'image_generation.partial_image', partial_image_index: 2, b64_json: 'QUFB' },
    ]);
  });

  it('should render a partial image as a data URL when the caller asked for one', async () => {
    const upstream = sseAnswer([
      {
        type: 'response.image_generation_call.partial_image',
        partial_image_b64: 'QUFB',
        partial_image_index: 1,
        output_format: ' JPG ',
      },
    ]);

    await expect(
      emittedEvents(codexImageStreamResponse(upstream, 'image_generation', ' URL ')),
    ).resolves.toEqual([
      {
        type: 'image_generation.partial_image',
        partial_image_index: 1,
        url: 'data:image/jpeg;base64,QUFB',
      },
    ]);
  });
});

describe('partial images a Codex stream leaves underspecified', () => {
  it('should default an unnamed partial index and format to PNG at position zero', async () => {
    const upstream = sseAnswer([
      { type: 'response.image_generation_call.partial_image', partial_image_b64: 'QUFB' },
    ]);

    await expect(
      emittedEvents(codexImageStreamResponse(upstream, 'image_generation', 'url')),
    ).resolves.toEqual([
      {
        type: 'image_generation.partial_image',
        partial_image_index: 0,
        url: 'data:image/png;base64,QUFB',
      },
    ]);
  });

  it.each([
    { type: 'response.image_generation_call.partial_image', partial_image_b64: '   ' },
    { type: 'response.image_generation_call.partial_image' },
    { type: 'response.output_text.delta', delta: 'hello' },
  ])('should stay silent for %j', async (event) => {
    const upstream = sseAnswer([event]);

    await expect(
      emittedEvents(codexImageStreamResponse(upstream, 'image_generation', 'b64_json')),
    ).resolves.toEqual([]);
  });
});

describe('a Codex image stream reaching completion', () => {
  it('should emit one completion per image, carrying the reported usage', async () => {
    const upstream = sseAnswer([
      {
        type: 'response.completed',
        response: {
          created_at: 1_700_000_000,
          output: [imageItem('QUFB', 'webp')],
          tool_usage: { image_gen: { images: 1 } },
        },
      },
    ]);

    await expect(
      emittedEvents(codexImageStreamResponse(upstream, 'image_generation', 'url')),
    ).resolves.toEqual([
      {
        type: 'image_generation.completed',
        url: 'data:image/webp;base64,QUFB',
        revised_prompt: 'a cat wearing a hat',
        usage: { images: 1 },
      },
    ]);
  });

  it('should fall back to the items it collected when the completion names no output', async () => {
    const upstream = sseAnswer([
      { type: 'response.output_item.done', output_index: 1, item: imageItem('QkJC', 'png') },
      { type: 'response.output_item.done', output_index: 0, item: imageItem('QUFB', 'png') },
      { type: 'response.completed', response: { created_at: 1, output: [] } },
    ]);

    const events = await emittedEvents(
      codexImageStreamResponse(upstream, 'image_generation', 'b64_json'),
    );

    expect(events.map((event) => event['b64_json'])).toEqual(['QUFB', 'QkJC']);
  });
});

describe('the items a Codex image stream collected along the way', () => {
  it('should keep an item the upstream reported without an output index', async () => {
    const upstream = sseAnswer([
      { type: 'response.output_item.done', item: imageItem('QUFB', 'png') },
      { type: 'response.output_item.done', output_index: 'first', item: { type: 'message' } },
      { type: 'response.output_item.done', item: 'not-an-item' },
      { type: 'response.completed', response: { created_at: 1, output: [] } },
    ]);

    const events = await emittedEvents(
      codexImageStreamResponse(upstream, 'image_generation', 'b64_json'),
    );

    expect(events.map((event) => event['b64_json'])).toEqual(['QUFB']);
  });

  it('should emit nothing when the completion carries no image at all', async () => {
    const upstream = sseAnswer([
      { type: 'response.completed', response: { created_at: 1, output: [{ type: 'message' }] } },
    ]);

    await expect(
      emittedEvents(codexImageStreamResponse(upstream, 'image_generation', 'b64_json')),
    ).resolves.toEqual([]);
  });
});

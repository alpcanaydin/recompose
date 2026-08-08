import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { codexImageJsonResponse } from './codex-image-response';

function sseAnswer(events: readonly JsonObject[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function completion(output: readonly JsonObject[], usage?: JsonObject): JsonObject {
  return {
    type: 'response.completed',
    response: {
      created_at: 1_700_000_000,
      output,
      ...(usage === undefined ? {} : { tool_usage: { image_gen: usage } }),
    },
  };
}

describe('a Codex image answer the gateway cannot read', () => {
  it('should pass an upstream failure straight through', async () => {
    const upstream = new Response('rate limited', { status: 429 });

    await expect(codexImageJsonResponse(upstream, 'b64_json')).resolves.toBe(upstream);
  });

  it('should pass an upstream answer that carries no body straight through', async () => {
    const upstream = new Response(null, { status: 200 });

    await expect(codexImageJsonResponse(upstream, 'b64_json')).resolves.toBe(upstream);
  });

  it('should report a bad gateway when the stream never completes with an image', async () => {
    const upstream = sseAnswer([{ type: 'response.output_text.delta', delta: 'hello' }]);
    const answer = await codexImageJsonResponse(upstream, 'b64_json');

    expect(answer.status).toBe(502);
    await expect(answer.json()).resolves.toEqual({
      error: { message: 'upstream did not return image output' },
    });
  });
});

describe('a Codex image answer collected into one JSON body', () => {
  it('should report every image alongside the metadata the upstream named', async () => {
    const upstream = sseAnswer([
      completion(
        [
          {
            type: 'image_generation_call',
            result: 'QUFB',
            revised_prompt: 'a cat wearing a hat',
            output_format: 'webp',
            size: '1024x1024',
            background: 'opaque',
            quality: 'high',
          },
        ],
        { images: 1 },
      ),
    ]);
    const answer = await codexImageJsonResponse(upstream, 'url');

    expect(answer.status).toBe(200);
    await expect(answer.json()).resolves.toEqual({
      created: 1_700_000_000,
      data: [{ url: 'data:image/webp;base64,QUFB', revised_prompt: 'a cat wearing a hat' }],
      background: 'opaque',
      output_format: 'webp',
      quality: 'high',
      size: '1024x1024',
      usage: { images: 1 },
    });
  });
});

describe('a Codex image answer the upstream barely described', () => {
  it('should leave out every metadata field the upstream left blank', async () => {
    const upstream = sseAnswer([completion([{ type: 'image_generation_call', result: 'QUFB' }])]);

    await expect((await codexImageJsonResponse(upstream, 'b64_json')).json()).resolves.toEqual({
      created: 1_700_000_000,
      data: [{ b64_json: 'QUFB' }],
    });
  });

  it('should report an empty gallery when the completion names no image', async () => {
    const upstream = sseAnswer([completion([{ type: 'message', role: 'assistant' }])]);

    await expect((await codexImageJsonResponse(upstream, 'b64_json')).json()).resolves.toEqual({
      created: 1_700_000_000,
      data: [],
    });
  });

  it('should read the images it collected before a completion with no output', async () => {
    const upstream = sseAnswer([
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: { type: 'image_generation_call', result: 'QUFB', output_format: 'jpg' },
      },
      completion([]),
    ]);

    await expect((await codexImageJsonResponse(upstream, 'url')).json()).resolves.toEqual({
      created: 1_700_000_000,
      data: [{ url: 'data:image/jpeg;base64,QUFB' }],
      output_format: 'jpg',
    });
  });
});

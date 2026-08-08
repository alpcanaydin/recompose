import { describe, expect, it } from 'vitest';

import type { HubStreamEvent } from './hub';
import type { ResponsesStreamEvent, ResponsesStreamItem } from './responses-wire';

import { decodeStream } from './responses-stream';
import { collect, streamOf } from './responses.testkit';

function aStreamCarrying(item: ResponsesStreamItem): readonly ResponsesStreamEvent[] {
  return [
    { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', output: [] } },
    { type: 'response.output_item.done', output_index: 3, item },
    { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [] } },
  ];
}

async function mediaOf(events: readonly ResponsesStreamEvent[]): Promise<HubStreamEvent[]> {
  const decoded = await collect(decodeStream(streamOf(events)));

  return decoded.filter((event) => event.type === 'media');
}

describe('decodeStream: a completed image generation call', () => {
  it('carries the image with the default media type when the vendor named no format', async () => {
    const media = await mediaOf(
      aStreamCarrying({ type: 'image_generation_call', result: 'ZGF0YQ==' }),
    );

    expect(media).toEqual([
      {
        type: 'media',
        block: {
          type: 'image',
          source: { type: 'base64', mediaType: 'image/png', data: 'ZGF0YQ==' },
        },
      },
    ]);
  });

  it('carries nothing when the call finished without an image', async () => {
    const media = await mediaOf(aStreamCarrying({ type: 'image_generation_call' }));

    expect(media).toEqual([]);
  });
});

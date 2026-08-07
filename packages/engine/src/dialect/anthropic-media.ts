import type { AnthropicContentBlock } from './anthropic-wire';
import type { HubContentBlock } from './hub';

type HubAudioVideo = Extract<HubContentBlock, { type: 'audio' | 'video' }>;

export function isHubAudioVideo(block: HubContentBlock): block is HubAudioVideo {
  return block.type === 'audio' || block.type === 'video';
}

export function anthropicMediaBlock(block: HubAudioVideo): AnthropicContentBlock {
  return block.source.type === 'base64'
    ? {
        type: 'document',
        source: {
          type: 'base64',
          media_type: block.source.mediaType,
          data: block.source.data,
        },
        title: block.type,
      }
    : { type: 'text', text: block.source.url };
}

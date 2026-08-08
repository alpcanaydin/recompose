import type { GeminiPart } from './gemini-wire';
import type { HubContentBlock } from './hub';

function binaryPart(
  block: Extract<HubContentBlock, { type: 'image' | 'audio' | 'video' }>,
): GeminiPart {
  return block.source.type === 'base64'
    ? { inlineData: { mimeType: block.source.mediaType, data: block.source.data } }
    : { fileData: { fileUri: block.source.url } };
}

function documentPart(block: Extract<HubContentBlock, { type: 'document' }>): GeminiPart {
  return block.source.type === 'url'
    ? { fileData: { fileUri: block.source.url } }
    : { inlineData: { mimeType: block.source.mediaType, data: block.source.data } };
}

export function geminiMediaPart(block: HubContentBlock): GeminiPart | null {
  if (block.type === 'image' || block.type === 'audio' || block.type === 'video') {
    return binaryPart(block);
  }

  if (block.type !== 'document') return null;

  return documentPart(block);
}

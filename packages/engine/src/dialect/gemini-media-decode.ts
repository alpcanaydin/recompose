import type { GeminiPart } from './gemini-wire';
import type { HubContentBlock, HubImageSource } from './hub';

function mediaKind(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';

  return 'document';
}

function sourcedBlock(mimeType: string, source: HubImageSource): HubContentBlock | null {
  const kind = mediaKind(mimeType);

  if (kind === 'document') {
    return source.type === 'base64' ? { type: 'document', source, filename: 'document' } : null;
  }

  return { type: kind, source };
}

export function geminiMediaBlock(part: GeminiPart): HubContentBlock | null {
  if (part.inlineData !== undefined) {
    return sourcedBlock(part.inlineData.mimeType, {
      type: 'base64',
      mediaType: part.inlineData.mimeType,
      data: part.inlineData.data,
    });
  }

  if (part.fileData?.fileUri === undefined) return null;

  return sourcedBlock(part.fileData.mimeType ?? 'image/unknown', {
    type: 'url',
    url: part.fileData.fileUri,
  });
}

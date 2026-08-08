import type { ChatContentPart } from './chat-completions-wire';
import type { HubAudioBlock, HubContentBlock, HubDocumentBlock, HubVideoBlock } from './hub';

import { imageSourceFromUrl } from './hub-build';
import { normalizeOpenAIFileData } from './openai-file-data';

type HubChatMedia = HubAudioBlock | HubVideoBlock | HubDocumentBlock;

export function isHubChatMedia(block: HubContentBlock): block is HubChatMedia {
  return block.type === 'audio' || block.type === 'video' || block.type === 'document';
}

function mediaData(block: HubVideoBlock): string {
  return block.source.type === 'url'
    ? block.source.url
    : `data:${block.source.mediaType};base64,${block.source.data}`;
}

function audioPart(block: HubAudioBlock): ChatContentPart | null {
  if (block.source.type !== 'base64') return null;

  return {
    type: 'input_audio',
    input_audio: {
      data: block.source.data,
      format:
        block.source.mediaType === 'audio/mpeg'
          ? 'mp3'
          : (block.source.mediaType.split('/').at(-1) ?? block.source.mediaType),
    },
  };
}

export function chatPartFromHubMedia(block: HubChatMedia): ChatContentPart | null {
  if (block.type === 'audio') return audioPart(block);
  if (block.type === 'video') return { type: 'video_url', video_url: { url: mediaData(block) } };

  if (block.source.type === 'url') {
    return { type: 'file', file: { filename: block.filename, file_data: block.source.url } };
  }

  return {
    type: 'file',
    file: {
      filename: block.filename,
      file_data: `data:${block.source.mediaType};base64,${block.source.data}`,
    },
  };
}

function fileBlock(part: Extract<ChatContentPart, { type: 'file' }>): HubContentBlock[] {
  const normalized = normalizeOpenAIFileData(part.file.filename, undefined, part.file.file_data);

  return normalized === null
    ? []
    : [
        {
          type: 'document',
          source: { type: 'base64', mediaType: normalized.mediaType, data: normalized.data },
          filename: part.file.filename,
        },
      ];
}

function documentBlock(part: Extract<ChatContentPart, { type: 'document' }>): HubContentBlock[] {
  return [
    {
      type: 'document',
      source: { type: 'base64', mediaType: part.mime_type, data: part.data },
      filename: part.name ?? 'document',
    },
  ];
}

export function hubMediaFromChat(part: ChatContentPart): HubContentBlock[] | null {
  if (part.type === 'input_audio') {
    return [
      {
        type: 'audio',
        source: {
          type: 'base64',
          mediaType: audioMediaType(part.input_audio.format),
          data: part.input_audio.data,
        },
      },
    ];
  }

  if (part.type === 'video_url') {
    return [{ type: 'video', source: imageSourceFromUrl(part.video_url.url) }];
  }

  if (part.type === 'document') return documentBlock(part);

  if (part.type === 'file') return fileBlock(part);

  return null;
}

function audioMediaType(format: string): string {
  return format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
}

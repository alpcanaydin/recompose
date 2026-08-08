import type {
  HubAudioBlock,
  HubDocumentBlock,
  HubImageBlock,
  HubTextBlock,
  HubVideoBlock,
} from './hub';
import type { ResponsesContentPart } from './responses-wire';

type VisibleBlock = HubTextBlock | HubImageBlock | HubDocumentBlock | HubAudioBlock | HubVideoBlock;

function mediaData(source: HubImageBlock['source']): string {
  return source.type === 'url' ? source.url : `data:${source.mediaType};base64,${source.data}`;
}

function filePart(
  role: 'user' | 'assistant',
  data: string,
  filename: string,
): ResponsesContentPart {
  return {
    type: role === 'user' ? 'input_file' : 'output_file',
    file_data: data,
    filename,
  };
}

function audioPart(role: 'user' | 'assistant', block: HubAudioBlock): ResponsesContentPart {
  if (role === 'user' && block.source.type === 'base64') {
    return {
      type: 'input_audio',
      input_audio: {
        data: block.source.data,
        format: responsesAudioFormat(block.source.mediaType),
      },
    };
  }

  return { type: 'output_text', text: `[audio: ${mediaData(block.source)}]` };
}

function responsesAudioFormat(mediaType: string): string {
  if (mediaType === 'audio/mpeg') return 'mp3';

  const separator = mediaType.lastIndexOf('/');

  return separator === -1 ? mediaType : mediaType.slice(separator + 1);
}

export function responsesPartFromHubBlock(
  role: 'user' | 'assistant',
  block: VisibleBlock,
): ResponsesContentPart {
  if (block.type !== 'document') return basicPart(role, block);

  return filePart(role, mediaData(block.source), block.filename);
}

function basicPart(
  role: 'user' | 'assistant',
  block: Exclude<VisibleBlock, { type: 'document' }>,
): ResponsesContentPart {
  if (block.type === 'text') {
    return role === 'assistant'
      ? { type: 'output_text', text: block.text }
      : { type: 'input_text', text: block.text };
  }

  if (block.type === 'image') {
    return { type: 'input_image', image_url: mediaData(block.source) };
  }

  if (block.type === 'audio') return audioPart(role, block);

  return filePart(role, mediaData(block.source), 'video');
}

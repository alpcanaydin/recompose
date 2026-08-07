import type {
  AnthropicCacheControl,
  AnthropicContentBlock,
  AnthropicDocumentPart,
  AnthropicImageBlock,
  AnthropicImageSource,
  AnthropicSearchResultPart,
  AnthropicTextBlock,
  AnthropicToolReferencePart,
  AnthropicToolResultBlock,
  AnthropicToolResultContent,
  AnthropicToolUseBlock,
} from './anthropic-wire';
import type { Fate } from './fates';
import type {
  HubCacheBreakpoint,
  HubContentBlock,
  HubDocumentBlock,
  HubImageBlock,
  HubImageSource,
  HubTextBlock,
  HubToolResultBlock,
  HubToolResultContent,
  HubToolUseBlock,
} from './hub';

import { anthropicMediaBlock, isHubAudioVideo } from './anthropic-media';

function hubSourceFrom(source: AnthropicImageSource): HubImageSource {
  if (source.type === 'url') {
    return { type: 'url', url: source.url };
  }

  return { type: 'base64', mediaType: source.media_type, data: source.data };
}

function wireSourceFrom(source: HubImageSource): AnthropicImageSource {
  if (source.type === 'url') {
    return { type: 'url', url: source.url };
  }

  return { type: 'base64', media_type: source.mediaType, data: source.data };
}

export function hubBreakpointOf(control: AnthropicCacheControl | undefined): {
  cacheBreakpoint?: HubCacheBreakpoint;
} {
  return control === undefined ? {} : { cacheBreakpoint: { type: 'ephemeral' } };
}

export function wireCacheControlOf(breakpoint: HubCacheBreakpoint | undefined): {
  cache_control?: AnthropicCacheControl;
} {
  return breakpoint === undefined ? {} : { cache_control: { type: 'ephemeral' } };
}

function hubTextFrom(block: AnthropicTextBlock): HubTextBlock {
  return { type: 'text', text: block.text, ...hubBreakpointOf(block.cache_control) };
}

function dropToolResultPart(
  part: AnthropicSearchResultPart | AnthropicDocumentPart | AnthropicToolReferencePart,
  fates: Fate[],
): void {
  switch (part.type) {
    case 'search_result':
    case 'document':
      fates.push({
        field: `tool_result[${part.type}]`,
        disposition: 'mapped',
        to: 'absent',
        costBearing: true,
      });

      return;
    case 'tool_reference':
      fates.push({ field: 'tool_result[tool_reference]', disposition: 'mapped', to: 'absent' });

      return;

    default: {
      const unknownPart: never = part;

      throw new Error(
        `hubBlockFrom met an unknown tool_result part: ${JSON.stringify(unknownPart)}`,
      );
    }
  }
}

function hubToolResultPartFrom(
  part: AnthropicToolResultContent,
  fates: Fate[],
): HubToolResultContent | undefined {
  if (part.type === 'text') {
    return hubTextFrom(part);
  }

  if (part.type === 'image') {
    return { type: 'image', source: hubSourceFrom(part.source) };
  }

  dropToolResultPart(part, fates);

  return undefined;
}

function hubToolResultContentFrom(
  content: AnthropicToolResultBlock['content'],
  fates: Fate[],
): readonly HubToolResultContent[] {
  if (content === undefined) {
    return [];
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.flatMap((part) => {
    const carried = hubToolResultPartFrom(part, fates);

    return carried === undefined ? [] : [carried];
  });
}

function hubToolResultFrom(block: AnthropicToolResultBlock, fates: Fate[]): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: block.tool_use_id,
    content: hubToolResultContentFrom(block.content, fates),
    ...(block.is_error === true ? { isError: true } : {}),
  };
}

function hubContentBlockFrom(
  block:
    | AnthropicTextBlock
    | AnthropicImageBlock
    | AnthropicToolUseBlock
    | AnthropicToolResultBlock,
  fates: Fate[],
): HubContentBlock {
  switch (block.type) {
    case 'text':
      return hubTextFrom(block);
    case 'image':
      return { type: 'image', source: hubSourceFrom(block.source) };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return hubToolResultFrom(block, fates);

    default: {
      const unknownBlock: never = block;

      throw new Error(`hubBlockFrom met an unknown wire block: ${JSON.stringify(unknownBlock)}`);
    }
  }
}

function hubDocumentFrom(block: AnthropicDocumentPart): HubDocumentBlock {
  const type = block.source['type'];
  const mediaType = block.source['media_type'];
  const data = block.source['data'];

  return {
    type: 'document',
    source: {
      type: type === 'base64' ? type : 'base64',
      mediaType: typeof mediaType === 'string' ? mediaType : 'application/pdf',
      data: typeof data === 'string' ? data : '',
    },
    filename: block.title ?? 'document.pdf',
  };
}

export function hubBlockFrom(block: AnthropicContentBlock, fates: Fate[]): HubContentBlock {
  if (block.type === 'document') {
    return hubDocumentFrom(block);
  }

  if (block.type === 'thinking') {
    return {
      type: 'thinking',
      text: block.thinking,
      ...(block.signature === undefined ? {} : { signature: block.signature }),
    };
  }

  if (block.type === 'redacted_thinking') {
    return { type: 'redacted_thinking', data: block.data };
  }

  return hubContentBlockFrom(block, fates);
}

function wireTextFrom(block: HubTextBlock): AnthropicTextBlock {
  return { type: 'text', text: block.text, ...wireCacheControlOf(block.cacheBreakpoint) };
}

function wireToolResultPartFrom(part: HubToolResultContent): AnthropicToolResultContent {
  if (part.type === 'text') {
    return wireTextFrom(part);
  }

  return { type: 'image', source: wireSourceFrom(part.source) };
}

function wireToolResultFrom(block: HubToolResultBlock): AnthropicToolResultBlock {
  return {
    type: 'tool_result',
    tool_use_id: block.toolUseId,
    content: block.content.map(wireToolResultPartFrom),
    ...(block.isError === true ? { is_error: true } : {}),
  };
}

function wireContentBlockFrom(
  block: HubTextBlock | HubImageBlock | HubToolUseBlock | HubToolResultBlock,
): AnthropicContentBlock {
  switch (block.type) {
    case 'text':
      return wireTextFrom(block);
    case 'image':
      return { type: 'image', source: wireSourceFrom(block.source) };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return wireToolResultFrom(block);

    default: {
      const unknownBlock: never = block;

      throw new Error(`wireBlockFrom met an unknown hub block: ${JSON.stringify(unknownBlock)}`);
    }
  }
}

export function wireBlockFrom(block: HubContentBlock): AnthropicContentBlock {
  if (isHubAudioVideo(block)) return anthropicMediaBlock(block);

  if (block.type === 'document') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: block.source.mediaType,
        data: block.source.data,
      },
      title: block.filename,
    };
  }

  if (block.type === 'thinking' || block.type === 'redacted_thinking') return wireThinking(block);

  return wireContentBlockFrom(block);
}

function wireThinking(
  block: Extract<HubContentBlock, { type: 'thinking' | 'redacted_thinking' }>,
): AnthropicContentBlock {
  return block.type === 'thinking'
    ? {
        type: 'thinking',
        thinking: block.text,
        ...(block.signature === undefined ? {} : { signature: block.signature }),
      }
    : { type: 'redacted_thinking', data: block.data };
}

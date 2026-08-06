import type {
  AnthropicCacheControl,
  AnthropicContentBlock,
  AnthropicImageBlock,
  AnthropicImageSource,
  AnthropicTextBlock,
  AnthropicToolResultBlock,
  AnthropicToolResultContent,
  AnthropicToolUseBlock,
} from './anthropic-wire';
import type {
  HubCacheBreakpoint,
  HubContentBlock,
  HubImageBlock,
  HubImageSource,
  HubTextBlock,
  HubToolResultBlock,
  HubToolResultContent,
  HubToolUseBlock,
} from './hub';

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

function hubToolResultPartFrom(part: AnthropicToolResultContent): HubToolResultContent {
  if (part.type === 'text') {
    return hubTextFrom(part);
  }

  return { type: 'image', source: hubSourceFrom(part.source) };
}

function hubToolResultContentFrom(
  content: AnthropicToolResultBlock['content'],
): readonly HubToolResultContent[] {
  if (content === undefined) {
    return [];
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map(hubToolResultPartFrom);
}

function hubToolResultFrom(block: AnthropicToolResultBlock): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: block.tool_use_id,
    content: hubToolResultContentFrom(block.content),
    ...(block.is_error === true ? { isError: true } : {}),
  };
}

function hubContentBlockFrom(
  block:
    | AnthropicTextBlock
    | AnthropicImageBlock
    | AnthropicToolUseBlock
    | AnthropicToolResultBlock,
): HubContentBlock {
  switch (block.type) {
    case 'text':
      return hubTextFrom(block);
    case 'image':
      return { type: 'image', source: hubSourceFrom(block.source) };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return hubToolResultFrom(block);

    default: {
      const unknownBlock: never = block;

      throw new Error(`hubBlockFrom met an unknown wire block: ${JSON.stringify(unknownBlock)}`);
    }
  }
}

export function hubBlockFrom(block: AnthropicContentBlock): HubContentBlock {
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

  return hubContentBlockFrom(block);
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
  if (block.type === 'thinking') {
    return {
      type: 'thinking',
      thinking: block.text,
      ...(block.signature === undefined ? {} : { signature: block.signature }),
    };
  }

  if (block.type === 'redacted_thinking') {
    return { type: 'redacted_thinking', data: block.data };
  }

  return wireContentBlockFrom(block);
}

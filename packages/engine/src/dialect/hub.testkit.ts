import type {
  HubImageBlock,
  HubMessage,
  HubRequest,
  HubResponse,
  HubStreamEvent,
  HubSystemText,
  HubTextBlock,
  HubThinkingBlock,
  HubTool,
  HubToolResultBlock,
  HubToolUseBlock,
  HubUsage,
} from './hub';

export function aHubTextBlock(overrides: Partial<HubTextBlock> = {}): HubTextBlock {
  return { type: 'text', text: 'hello from the hub', ...overrides };
}

export function aHubThinkingBlock(overrides: Partial<HubThinkingBlock> = {}): HubThinkingBlock {
  return { type: 'thinking', text: 'weigh the two routes before answering', ...overrides };
}

export function aHubImageBlock(overrides: Partial<HubImageBlock> = {}): HubImageBlock {
  return {
    type: 'image',
    source: { type: 'base64', mediaType: 'image/png', data: 'aGVsbG8=' },
    ...overrides,
  };
}

export function aHubToolUseBlock(overrides: Partial<HubToolUseBlock> = {}): HubToolUseBlock {
  return {
    type: 'tool_use',
    id: 'toolu_weather',
    name: 'get_weather',
    input: { city: 'Paris' },
    ...overrides,
  };
}

export function aHubToolResultBlock(
  overrides: Partial<HubToolResultBlock> = {},
): HubToolResultBlock {
  return {
    type: 'tool_result',
    toolUseId: 'toolu_weather',
    content: [aHubTextBlock({ text: 'sunny, 21C' })],
    ...overrides,
  };
}

export function aHubSystemText(overrides: Partial<HubSystemText> = {}): HubSystemText {
  return { text: 'You answer concisely.', ...overrides };
}

export function aHubMessage(overrides: Partial<HubMessage> = {}): HubMessage {
  return { role: 'user', content: [aHubTextBlock()], ...overrides };
}

export function aHubTool(overrides: Partial<HubTool> = {}): HubTool {
  return {
    name: 'get_weather',
    description: 'Look up the weather for a city',
    inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
    ...overrides,
  };
}

export function aHubRequest(overrides: Partial<HubRequest> = {}): HubRequest {
  return { messages: [aHubMessage()], ...overrides };
}

export function aHubUsage(overrides: Partial<HubUsage> = {}): HubUsage {
  return { inputTokens: 12, outputTokens: 8, ...overrides };
}

export function aHubResponse(overrides: Partial<HubResponse> = {}): HubResponse {
  return { content: [aHubTextBlock()], stopReason: 'end', usage: aHubUsage(), ...overrides };
}

export function aHubStreamOfAToolCall(): readonly HubStreamEvent[] {
  return [
    { type: 'message-begin', usage: { inputTokens: 12 } },
    {
      type: 'block-open',
      index: 0,
      opening: { kind: 'tool', id: 'toolu_weather', name: 'get_weather' },
    },
    {
      type: 'block-delta',
      index: 0,
      delta: { kind: 'json-args', partialJson: '{"city":"Paris"}' },
    },
    { type: 'block-close', index: 0 },
    { type: 'message-end', stopReason: 'tool_use', usage: aHubUsage() },
  ];
}

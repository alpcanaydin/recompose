export type HubCacheBreakpoint = { readonly type: 'ephemeral' };

export type HubJsonObject = { readonly [key: string]: unknown };

export type HubTextBlock = {
  type: 'text';
  text: string;
  cacheBreakpoint?: HubCacheBreakpoint;
};

export type HubThinkingBlock = {
  type: 'thinking';
  text: string;
  signature?: string;
};

export type HubRedactedThinkingBlock = {
  type: 'redacted_thinking';
  data: string;
};

export type HubImageSource =
  | { type: 'base64'; mediaType: string; data: string }
  | { type: 'url'; url: string };

export type HubImageBlock = {
  type: 'image';
  source: HubImageSource;
};

export type HubAudioBlock = {
  type: 'audio';
  source: HubImageSource;
};

export type HubVideoBlock = {
  type: 'video';
  source: HubImageSource;
};

export type HubDocumentBlock = {
  type: 'document';
  source: { type: 'base64'; mediaType: string; data: string };
  filename: string;
};

export type HubToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: HubJsonObject;
  signature?: string;
};

export type HubToolResultContent = HubTextBlock | HubImageBlock;

export type HubToolResultBlock = {
  type: 'tool_result';
  toolUseId: string;
  content: readonly HubToolResultContent[];
  isError?: boolean;
};

export type HubContentBlock =
  | HubTextBlock
  | HubThinkingBlock
  | HubRedactedThinkingBlock
  | HubImageBlock
  | HubAudioBlock
  | HubVideoBlock
  | HubDocumentBlock
  | HubToolUseBlock
  | HubToolResultBlock;

export type HubSystemText = {
  text: string;
  cacheBreakpoint?: HubCacheBreakpoint;
};

export type HubMessage = {
  role: 'user' | 'assistant';
  content: readonly HubContentBlock[];
};

export type HubToolSchema = {
  type: 'object';
  properties: HubJsonObject;
  required?: readonly string[];
};

export type HubTool = {
  name: string;
  description?: string;
  inputSchema: HubToolSchema;
};

export type HubWebSearchTool = {
  type: 'web_search';
  name: string;
  allowedDomains?: readonly string[];
  userLocation?: HubJsonObject;
};

export type HubToolChoice =
  | { type: 'auto' }
  | { type: 'none' }
  | { type: 'required' }
  | { type: 'tool'; name: string }
  | { type: 'web_search' };

export type HubSampling = {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: readonly string[];
};

export type HubReasoning = {
  effort?: string;
  summary?: string;
  budgetTokens?: number;
};

export type HubRequest = {
  system?: readonly HubSystemText[];
  messages: readonly HubMessage[];
  tools?: readonly HubTool[];
  serverTools?: readonly HubWebSearchTool[];
  toolChoice?: HubToolChoice;
  parallelToolCalls?: boolean;
  serviceTier?: string;
  previousResponseId?: string;
  reasoning?: HubReasoning;
  responseModalities?: readonly string[];
  responseFormat?: unknown;
  sampling?: HubSampling;
};

export type HubStopReason =
  | 'end'
  | 'max_output'
  | 'stop_sequence'
  | 'tool_use'
  | 'paused'
  | 'refusal'
  | 'context_overflow';

export type HubUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
};

export type HubResponse = {
  content: readonly HubContentBlock[];
  stopReason: HubStopReason;
  usage: HubUsage;
};

export type HubBlockOpening =
  | { kind: 'text' }
  | { kind: 'thinking' }
  | { kind: 'tool'; id: string; name: string; signature?: string };

export type HubBlockDelta =
  | { kind: 'text'; text: string }
  | { kind: 'json-args'; partialJson: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'signature'; signature: string };

export type HubStreamErrorPayload = {
  type: string;
  message: string;
};

export type HubStreamEvent =
  | { type: 'message-begin'; usage?: HubUsage }
  | { type: 'block-open'; index: number; opening: HubBlockOpening }
  | { type: 'block-delta'; index: number; delta: HubBlockDelta }
  | { type: 'block-close'; index: number }
  | { type: 'message-end'; stopReason: HubStopReason; usage: HubUsage }
  | { type: 'stream-error'; error: HubStreamErrorPayload };

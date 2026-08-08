export type HubCacheBreakpoint = { readonly type: 'ephemeral'; ttl?: '5m' | '1h' };

export type HubJsonObject = { readonly [key: string]: unknown };
export type HubToolInput =
  | HubJsonObject
  | readonly unknown[]
  | string
  | number
  | boolean
  | null
  | undefined;

export type HubTextBlock = {
  type: 'text';
  text: string;
  citations?: readonly HubJsonObject[];
  signature?: string;
  signatureDirection?: 'next' | 'previous';
  cacheBreakpoint?: HubCacheBreakpoint;
};

export type HubThinkingBlock = {
  type: 'thinking';
  text: string;
  signature?: string;
  carrierDirection?: 'next' | 'previous' | 'standalone';
  carrierTarget?: 'text' | 'function' | 'any';
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
  detail?: string;
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
  source: HubImageSource;
  filename: string;
};

export type HubToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: HubToolInput;
  family?: 'function' | 'custom';
  signature?: string;
};

export type HubToolResultContent = HubTextBlock | HubImageBlock;

export type HubToolResultBlock = {
  type: 'tool_result';
  toolUseId: string;
  name?: string;
  content: readonly HubToolResultContent[];
  structuredResult?: unknown;
  cacheBreakpoint?: HubCacheBreakpoint;
  isError?: boolean;
  family?: 'function' | 'custom';
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
  markerType?: string;
  cacheBreakpoint?: HubCacheBreakpoint;
};

export type HubMessage = {
  role: 'user' | 'assistant';
  content: readonly HubContentBlock[];
  boundary?: 'system-reminder';
};

export type HubToolSchema = {
  readonly [key: string]: unknown;
  type: 'object';
  properties: HubJsonObject;
  required?: readonly string[];
};

export type HubTool = {
  name: string;
  description?: string;
  inputSchema: HubToolSchema;
  cacheBreakpoint?: HubCacheBreakpoint;
  family?: 'function' | 'custom';
};

export type HubWebSearchTool = {
  type: 'web_search';
  name: string;
  allowedDomains?: readonly string[];
  userLocation?: HubJsonObject;
  maxUses?: number;
};

export type HubToolChoice =
  | { type: 'auto' }
  | { type: 'none' }
  | { type: 'required' }
  | { type: 'tool'; name: string; family?: 'function' | 'custom' }
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
  sourceModel?: string;
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
  geminiGenerationConfig?: HubJsonObject;
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
  totalInputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  webSearchRequests?: number;
};

export type HubResponse = {
  id?: string;
  model?: string;
  content: readonly HubContentBlock[];
  stopReason: HubStopReason;
  stopSequence?: string;
  usage: HubUsage;
};

export type HubBlockOpening =
  | { kind: 'text'; signature?: string; signatureDirection?: 'next' | 'previous' }
  | {
      kind: 'thinking';
      signature?: string;
      carrierDirection?: 'next' | 'previous' | 'standalone';
      carrierTarget?: 'text' | 'function' | 'any';
    }
  | {
      kind: 'tool';
      id: string;
      name: string;
      signature?: string;
      serverInput?: HubJsonObject;
    };

export type HubBlockDelta =
  | { kind: 'text'; text: string }
  | { kind: 'json-args'; partialJson: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'signature'; signature: string }
  | { kind: 'annotation'; annotation: HubJsonObject };

export type HubStreamErrorPayload = {
  type: string;
  message: string;
};

export type HubStreamEvent =
  | { type: 'message-begin'; usage?: HubUsage; id?: string; model?: string }
  | { type: 'block-open'; index: number; opening: HubBlockOpening }
  | { type: 'block-delta'; index: number; delta: HubBlockDelta }
  | { type: 'block-close'; index: number }
  | {
      type: 'media';
      block: Extract<HubContentBlock, { type: 'image' | 'audio' | 'video' | 'document' }>;
    }
  | {
      type: 'message-end';
      stopReason: HubStopReason;
      usage: HubUsage;
      nativeStopReason?: string;
      stopSequence?: string;
    }
  | { type: 'stream-error'; error: HubStreamErrorPayload };

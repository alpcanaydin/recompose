import type { AnthropicDropField } from './anthropic-drops';
import type { HubJsonObject } from './hub';

export type AnthropicCacheControl = { type: 'ephemeral'; ttl?: '5m' | '1h' };

export type AnthropicTextBlock = {
  type: 'text';
  text: string;
  cache_control?: AnthropicCacheControl;
};

export type AnthropicImageSource =
  | { type: 'base64'; media_type: string; data: string }
  | { type: 'url'; url: string };

export type AnthropicImageBlock = {
  type: 'image';
  source: AnthropicImageSource;
  cache_control?: AnthropicCacheControl;
};

type AnthropicThinkingBlock = {
  type: 'thinking';
  thinking: string;
  signature?: string;
};

type AnthropicRedactedThinkingBlock = {
  type: 'redacted_thinking';
  data: string;
};

export type AnthropicToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: HubJsonObject;
  cache_control?: AnthropicCacheControl;
};

export type AnthropicToolResultContent = AnthropicTextBlock | AnthropicImageBlock;

export type AnthropicToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | readonly AnthropicToolResultContent[];
  is_error?: boolean;
  cache_control?: AnthropicCacheControl;
};

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicThinkingBlock
  | AnthropicRedactedThinkingBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | readonly AnthropicContentBlock[];
};

export type AnthropicSystem = string | readonly AnthropicTextBlock[];

export type AnthropicToolSchema = {
  type: 'object';
  properties?: HubJsonObject;
  required?: readonly string[];
};

export type AnthropicTool = {
  name: string;
  description?: string;
  input_schema?: AnthropicToolSchema;
  type?: string;
  cache_control?: AnthropicCacheControl;
};

export type AnthropicToolChoice =
  | { type: 'auto' | 'any' | 'none'; disable_parallel_tool_use?: boolean }
  | { type: 'tool'; name: string; disable_parallel_tool_use?: boolean };

type AnthropicIgnoredFields = { readonly [K in AnthropicDropField]?: unknown };

type AnthropicRequestCore = {
  model?: string;
  max_tokens?: number;
  messages: readonly AnthropicMessage[];
  system?: AnthropicSystem;
  tools?: readonly AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  temperature?: number;
  top_p?: number;
  stop_sequences?: readonly string[];
};

export type AnthropicRequest = AnthropicRequestCore & AnthropicIgnoredFields;

export type AnthropicKnownStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal'
  | 'model_context_window_exceeded';

export type AnthropicStopReason = AnthropicKnownStopReason | (string & {});

export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type AnthropicResponse = {
  id: string;
  type: 'message';
  role: 'assistant';
  model?: string;
  content: readonly AnthropicContentBlock[];
  stop_reason: AnthropicStopReason | null;
  stop_sequence?: string | null;
  usage?: AnthropicUsage;
};

export type AnthropicBlockDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'signature_delta'; signature: string };

export type AnthropicKnownStreamEvent =
  | { type: 'message_start'; message: AnthropicResponse }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | { type: 'content_block_delta'; index: number; delta: AnthropicBlockDelta }
  | { type: 'content_block_stop'; index: number }
  | {
      type: 'message_delta';
      delta: { stop_reason: AnthropicStopReason; stop_sequence: string | null };
      usage: AnthropicUsage;
    }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } };

type AnthropicUnknownStreamEvent = { type: string };

export type AnthropicStreamEvent = AnthropicKnownStreamEvent | AnthropicUnknownStreamEvent;

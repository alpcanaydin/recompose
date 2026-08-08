import type { ChatDropField } from './chat-completions-drops';
import type { HubJsonObject } from './hub';

export type ChatCacheControl = { type: 'ephemeral'; ttl?: '5m' | '1h' };

type ChatTextPart = { type: 'text'; text: string; cache_control?: ChatCacheControl };

type ChatImagePart = {
  type: 'image_url';
  image_url: { url: string; detail?: string };
  cache_control?: ChatCacheControl;
};

type ChatAudioPart = {
  type: 'input_audio';
  input_audio: { data: string; format: string };
};

type ChatVideoPart = {
  type: 'video_url';
  video_url: { url: string };
};

type ChatFilePart = {
  type: 'file';
  file: { filename: string; file_data: string };
};

type ChatDocumentPart = {
  type: 'document';
  mime_type: string;
  data: string;
  name?: string;
};

export type ChatContentPart =
  | ChatTextPart
  | ChatImagePart
  | ChatAudioPart
  | ChatVideoPart
  | ChatFilePart
  | ChatDocumentPart;

export type ChatToolCall = {
  id?: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
    extra_content?: { google?: { thought_signature?: string } };
  };
  extra_content?: { google?: { thought_signature?: string } };
  thoughtSignature?: string;
  thought_signature?: string;
};
export type ChatCustomToolCall = {
  id?: string;
  type: 'custom';
  custom: { name: string; input: string };
};

export type ChatSystemMessage = {
  role: 'system';
  content: string | readonly ChatContentPart[];
  cache_control?: ChatCacheControl;
};

export type ChatDeveloperMessage = {
  role: 'developer';
  content: string | readonly ChatContentPart[];
  cache_control?: ChatCacheControl;
};

export type ChatUserMessage = {
  role: 'user';
  content: string | readonly ChatContentPart[];
  cache_control?: ChatCacheControl;
};

export type ChatAssistantMessage = {
  role: 'assistant';
  content?: string | readonly ChatContentPart[] | null;
  reasoning_content?: string;
  tool_calls?: readonly (ChatToolCall | ChatCustomToolCall)[];
};

export type ChatToolMessage = {
  role: 'tool';
  tool_call_id?: string;
  content: string | readonly unknown[] | HubJsonObject | null;
  cache_control?: ChatCacheControl;
};

export type ChatMessage =
  | ChatSystemMessage
  | ChatDeveloperMessage
  | ChatUserMessage
  | ChatAssistantMessage
  | ChatToolMessage;

type ChatFunctionSchema = {
  readonly [key: string]: unknown;
  type?: 'object';
  properties?: HubJsonObject;
  required?: readonly string[];
  anyOf?: readonly unknown[];
  oneOf?: readonly unknown[];
};

export type ChatTool = {
  type: 'function';
  function: { name: unknown; description?: string; parameters: ChatFunctionSchema };
  cache_control?: ChatCacheControl;
};
type ChatCustomTool = { type: 'custom'; name: string; description?: string };

type ChatNamedToolChoice =
  | { type: 'function'; function: { name: string } }
  | { type: 'custom'; name: string };

export type ChatToolChoice = 'auto' | 'none' | 'required' | ChatNamedToolChoice;

type ChatIgnoredFields = { readonly [K in ChatDropField]?: unknown };

export type ChatCompletionsRequestCore = {
  model?: string;
  messages: readonly ChatMessage[];
  tools?: readonly (ChatTool | ChatCustomTool)[];
  tool_choice?: ChatToolChoice;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | readonly string[];
  response_format?: unknown;
  service_tier?: string;
  reasoning_effort?: string;
  modalities?: readonly string[];
  parallel_tool_calls?: boolean;
  generationConfig?: HubJsonObject;
  thinking?: HubJsonObject;
  reasoning?: HubJsonObject;
  extra_body?: HubJsonObject;
};

export type ChatCompletionsRequest = ChatCompletionsRequestCore & ChatIgnoredFields;

export type ChatFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | (string & {});

export type ChatUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cached_creation_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

export type ChatResponseMessage = {
  role: 'assistant';
  content: string | null;
  reasoning_content?: string;
  tool_calls?: readonly ChatToolCall[];
  images?: readonly ChatResponseImage[];
};

export type ChatResponseImage = { type: 'image_url'; image_url: { url: string } };

type ChatResponseChoice = {
  index: number;
  message: ChatResponseMessage;
  finish_reason: ChatFinishReason;
};

export type ChatCompletionsResponse = {
  id?: string;
  model?: string;
  choices: readonly ChatResponseChoice[];
  usage?: ChatUsage;
};

export type ChatToolCallDelta = {
  index?: number;
  id?: string;
  function?: { name?: unknown; arguments?: string };
};

type ChatChunkDelta = {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: readonly ChatToolCallDelta[];
  images?: readonly { type: 'image_url'; image_url: { url: string } }[];
};

export type ChatChunkChoice = {
  index: number;
  delta: ChatChunkDelta;
  finish_reason?: ChatFinishReason | null;
  native_finish_reason?: string;
};

export type ChatCompletionChunk = {
  id?: string;
  model?: string;
  choices: readonly ChatChunkChoice[];
  usage?: ChatUsage | null;
};

export type ChatStreamError = { type?: string; message: string };

export type ChatStreamFrame =
  | { type: 'chunk'; chunk: ChatCompletionChunk }
  | { type: 'error'; error: ChatStreamError }
  | { type: 'done' }
  | { type: 'unknown' };

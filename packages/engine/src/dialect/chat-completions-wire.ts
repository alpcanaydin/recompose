import type { ChatDropField } from './chat-completions-drops';
import type { HubJsonObject } from './hub';

export type ChatCacheControl = { type: 'ephemeral' };

type ChatTextPart = { type: 'text'; text: string; cache_control?: ChatCacheControl };

type ChatImagePart = {
  type: 'image_url';
  image_url: { url: string };
  cache_control?: ChatCacheControl;
};

export type ChatContentPart = ChatTextPart | ChatImagePart;

export type ChatToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatSystemMessage = {
  role: 'system';
  content: string;
  cache_control?: ChatCacheControl;
};

export type ChatDeveloperMessage = {
  role: 'developer';
  content: string;
  cache_control?: ChatCacheControl;
};

export type ChatUserMessage = {
  role: 'user';
  content: string | readonly ChatContentPart[];
  cache_control?: ChatCacheControl;
};

export type ChatAssistantMessage = {
  role: 'assistant';
  content?: string | null;
  tool_calls?: readonly ChatToolCall[];
};

export type ChatToolMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string | readonly ChatContentPart[];
};

export type ChatMessage =
  | ChatSystemMessage
  | ChatDeveloperMessage
  | ChatUserMessage
  | ChatAssistantMessage
  | ChatToolMessage;

type ChatFunctionSchema = {
  type?: 'object';
  properties?: HubJsonObject;
  required?: readonly string[];
  anyOf?: readonly unknown[];
  oneOf?: readonly unknown[];
};

export type ChatTool = {
  type: 'function';
  function: { name: string; description?: string; parameters: ChatFunctionSchema };
};

type ChatNamedToolChoice = { type: 'function'; function: { name: string } };

export type ChatToolChoice = 'auto' | 'none' | 'required' | ChatNamedToolChoice;

type ChatIgnoredFields = { readonly [K in ChatDropField]?: unknown };

export type ChatCompletionsRequestCore = {
  model?: string;
  messages: readonly ChatMessage[];
  tools?: readonly ChatTool[];
  tool_choice?: ChatToolChoice;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | readonly string[];
};

export type ChatCompletionsRequest = ChatCompletionsRequestCore & ChatIgnoredFields;

export type ChatFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

export type ChatUsage = { prompt_tokens: number; completion_tokens: number };

export type ChatResponseMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: readonly ChatToolCall[];
};

type ChatResponseChoice = {
  index: number;
  message: ChatResponseMessage;
  finish_reason: ChatFinishReason;
};

export type ChatCompletionsResponse = {
  choices: readonly ChatResponseChoice[];
  usage?: ChatUsage;
};

export type ChatToolCallDelta = {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
};

type ChatChunkDelta = {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: readonly ChatToolCallDelta[];
};

export type ChatChunkChoice = {
  index: number;
  delta: ChatChunkDelta;
  finish_reason?: ChatFinishReason | null;
};

export type ChatCompletionChunk = {
  choices: readonly ChatChunkChoice[];
  usage?: ChatUsage | null;
};

export type ChatStreamError = { type?: string; message: string };

export type ChatStreamFrame =
  | { type: 'chunk'; chunk: ChatCompletionChunk }
  | { type: 'error'; error: ChatStreamError }
  | { type: 'done' }
  | { type: 'unknown' };

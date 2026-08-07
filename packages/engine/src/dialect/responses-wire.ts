import type { HubJsonObject } from './hub';

export type ResponsesToolParameters = {
  type?: 'object';
  properties?: HubJsonObject;
  required?: readonly string[];
  anyOf?: readonly unknown[];
  oneOf?: readonly unknown[];
};

export type ResponsesFunctionTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters: ResponsesToolParameters;
  strict?: boolean;
};

type ResponsesWebSearchTool = {
  type: 'web_search';
  filters?: { allowed_domains: readonly string[] };
  user_location?: HubJsonObject;
};

export type ResponsesTool = ResponsesFunctionTool | ResponsesWebSearchTool;

export type ResponsesToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string }
  | { type: 'web_search' };

type ResponsesInputTextPart = { type: 'input_text'; text: string };
export type ResponsesOutputTextPart = { type: 'output_text'; text: string };
type ResponsesInputImagePart = { type: 'input_image'; image_url: string };
type ResponsesInputFilePart = { type: 'input_file'; file_data: string; filename: string };
type ResponsesOutputFilePart = { type: 'output_file'; file_data: string; filename: string };
type ResponsesInputAudioPart = {
  type: 'input_audio';
  input_audio: { data: string; format: string };
};

export type ResponsesContentPart =
  | ResponsesInputTextPart
  | ResponsesOutputTextPart
  | ResponsesInputImagePart
  | ResponsesInputFilePart
  | ResponsesOutputFilePart
  | ResponsesInputAudioPart;

export type ResponsesMessageItem = {
  type: 'message';
  role: 'user' | 'assistant';
  content: string | readonly ResponsesContentPart[];
};

export type ResponsesFunctionCallItem = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};

export type ResponsesFunctionCallOutputItem = {
  type: 'function_call_output';
  call_id: string;
  output: string;
};

type ResponsesReasoningSummaryPart = { type: 'summary_text'; text: string };

export type ResponsesReasoningItem = {
  type: 'reasoning';
  id?: string;
  summary?: readonly ResponsesReasoningSummaryPart[];
  encrypted_content?: string;
  content?: null;
};

export type ResponsesInputItem =
  | ResponsesMessageItem
  | ResponsesFunctionCallItem
  | ResponsesFunctionCallOutputItem
  | ResponsesReasoningItem;

export type ResponsesRequest = {
  model?: string;
  instructions?: string;
  input: readonly ResponsesInputItem[];
  tools?: readonly ResponsesTool[];
  tool_choice?: ResponsesToolChoice;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  previous_response_id?: string;
  reasoning?: { effort?: string; summary?: string };
  modalities?: readonly string[];
  response_format?: unknown;
  text?: { format?: unknown };
  store?: boolean;
  metadata?: HubJsonObject;
  service_tier?: string;
  top_logprobs?: number;
  truncation?: string;
  user?: string;
  parallel_tool_calls?: boolean;
  prompt_cache_key?: string;
};

export type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
};

type ResponsesOutputMessageItem = {
  type: 'message';
  role: 'assistant';
  content: readonly ResponsesOutputTextPart[];
};

export type ResponsesOutputItem =
  | ResponsesOutputMessageItem
  | ResponsesFunctionCallItem
  | ResponsesReasoningItem;

export type ResponsesStatus = 'completed' | 'incomplete' | 'failed';

export type ResponsesIncompleteReason = 'max_output_tokens' | 'content_filter';

export type ResponsesResponse = {
  id: string;
  status: ResponsesStatus;
  output: readonly ResponsesOutputItem[];
  incomplete_details?: { reason: string };
  usage?: ResponsesUsage;
};

export type ResponsesStreamResponse = {
  id: string;
  status: ResponsesStatus | 'in_progress';
  output: readonly ResponsesOutputItem[];
  incomplete_details?: { reason: string };
  usage?: ResponsesUsage;
  error?: {
    type?: string;
    code?: string;
    message?: string;
    resets_at?: number;
    resets_in_seconds?: number;
  };
};

export type ResponsesStreamItem = {
  type: string;
  role?: 'assistant';
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  encrypted_content?: string;
};

export type ResponsesKnownStreamEvent =
  | { type: 'response.created'; response: ResponsesStreamResponse }
  | { type: 'response.output_item.added'; output_index: number; item: ResponsesStreamItem }
  | { type: 'response.output_text.delta'; output_index: number; delta: string }
  | { type: 'response.reasoning_summary_text.delta'; output_index: number; delta: string }
  | { type: 'response.function_call_arguments.delta'; output_index: number; delta: string }
  | { type: 'response.output_item.done'; output_index: number; item?: ResponsesStreamItem }
  | { type: 'response.completed'; response: ResponsesStreamResponse }
  | { type: 'response.incomplete'; response: ResponsesStreamResponse }
  | { type: 'response.failed'; response: ResponsesStreamResponse }
  | {
      type: 'error';
      code?: string;
      message?: string;
      error?: {
        type?: string;
        code?: string;
        message?: string;
        resets_at?: number;
        resets_in_seconds?: number;
      };
    };

type ResponsesUnknownStreamEvent = { type: string };

export type ResponsesStreamEvent = ResponsesKnownStreamEvent | ResponsesUnknownStreamEvent;

import type { HubJsonObject } from './hub';
import type {
  ResponsesAdditionalToolsItem,
  ResponsesCustomToolCallItem,
  ResponsesCustomToolCallOutputItem,
  ResponsesCustomToolOutputItem,
} from './responses-extensions-wire';
import type { ResponsesTool, ResponsesToolChoice } from './responses-tools-wire';

export type { ResponsesCustomToolOutputItem } from './responses-extensions-wire';
export type {
  ResponsesCustomTool,
  ResponsesFunctionTool,
  ResponsesNamespaceTool,
  ResponsesTool,
  ResponsesToolChoice,
  ResponsesToolParameters,
} from './responses-tools-wire';

export type ResponsesCacheControl = { type: 'ephemeral'; ttl?: '5m' | '1h' };

type ResponsesInputTextPart = {
  type: 'input_text';
  text: string;
  cache_control?: ResponsesCacheControl;
};
export type ResponsesOutputTextPart = {
  type: 'output_text';
  text: string;
  annotations?: readonly HubJsonObject[];
  cache_control?: ResponsesCacheControl;
};
type ResponsesInputImagePart = {
  type: 'input_image';
  image_url: string;
  detail?: unknown;
  cache_control?: ResponsesCacheControl;
};
type ResponsesInputFilePart = {
  type: 'input_file';
  file_data: string;
  filename: string;
  cache_control?: ResponsesCacheControl;
};
type ResponsesOutputFilePart = {
  type: 'output_file';
  file_data: string;
  filename: string;
  cache_control?: ResponsesCacheControl;
};
type ResponsesInputAudioPart = {
  type: 'input_audio';
  input_audio: { data: string; format: string };
  cache_control?: ResponsesCacheControl;
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
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string | readonly ResponsesContentPart[];
  cache_control?: ResponsesCacheControl;
};

export type ResponsesFunctionCallItem = {
  type: 'function_call';
  id?: string;
  call_id: string;
  name: string;
  namespace?: string;
  arguments: string;
};

export type ResponsesFunctionCallOutputItem = {
  type: 'function_call_output';
  call_id: string;
  name?: string;
  output: unknown;
};

type ResponsesReasoningSummaryPart = { type: 'summary_text'; text: string };
type ResponsesReasoningTextPart = { type: 'reasoning_text'; text: string };

export type ResponsesReasoningItem = {
  type: 'reasoning';
  id?: string;
  summary?: readonly ResponsesReasoningSummaryPart[];
  encrypted_content?: string;
  content?: readonly ResponsesReasoningTextPart[] | null;
};

export type ResponsesInputItem =
  | ResponsesMessageItem
  | ResponsesFunctionCallItem
  | ResponsesFunctionCallOutputItem
  | ResponsesCustomToolCallItem
  | ResponsesCustomToolCallOutputItem
  | ResponsesAdditionalToolsItem
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
  total_tokens?: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
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
  | ResponsesCustomToolOutputItem
  | ResponsesReasoningItem
  | {
      type: 'web_search_call';
      id?: string;
      status?: string;
      action?: { type?: string; query?: string };
    }
  | {
      type: 'image_generation_call';
      id?: string;
      result: string;
      output_format?: string;
    };

export type ResponsesStatus = 'completed' | 'incomplete' | 'failed';

export type ResponsesIncompleteReason = 'max_output_tokens' | 'content_filter';

export type ResponsesResponse = {
  id: string;
  model?: string;
  status: ResponsesStatus;
  output: readonly ResponsesOutputItem[];
  incomplete_details?: { reason: string };
  stop_reason?: string;
  stop_sequence?: string;
  usage?: ResponsesUsage;
};

export type ResponsesStreamResponse = {
  id: string;
  model?: string;
  status: ResponsesStatus | 'in_progress';
  output: readonly ResponsesOutputItem[];
  incomplete_details?: { reason: string };
  stop_reason?: string;
  stop_sequence?: string;
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
  namespace?: string;
  arguments?: string;
  input?: string;
  encrypted_content?: string;
  content?: readonly (ResponsesOutputTextPart | ResponsesReasoningTextPart)[] | null;
  summary?: readonly ResponsesReasoningSummaryPart[];
  result?: string;
  output_format?: string;
  status?: string;
  action?: { type?: string; query?: string };
};

export type ResponsesKnownStreamEvent =
  | { type: 'response.created'; response: ResponsesStreamResponse }
  | { type: 'response.output_item.added'; output_index: number; item: ResponsesStreamItem }
  | { type: 'response.output_text.delta'; output_index: number; delta: string }
  | { type: 'response.reasoning_summary_text.delta'; output_index: number; delta: string }
  | {
      type: 'response.image_generation_call.partial_image';
      item_id: string;
      output_format?: string;
      partial_image_b64: string;
      partial_image_index?: number;
    }
  | {
      type: 'response.function_call_arguments.delta';
      output_index: number;
      delta: string;
      item_id?: string;
      call_id?: string;
      name?: string;
    }
  | {
      type: 'response.function_call_arguments.done';
      output_index: number;
      item_id?: string;
      arguments: string;
    }
  | {
      type: 'response.custom_tool_call_input.delta';
      output_index: number;
      item_id?: string;
      delta: string;
    }
  | {
      type: 'response.custom_tool_call_input.done';
      output_index: number;
      item_id?: string;
      input: string;
    }
  | {
      type: 'response.output_text.done';
      output_index: number;
      item_id?: string;
      content_index: number;
      text: string;
    }
  | {
      type: 'response.content_part.done';
      output_index: number;
      item_id?: string;
      content_index: number;
      part: ResponsesOutputTextPart;
    }
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

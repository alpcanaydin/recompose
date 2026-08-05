import type { HubJsonObject } from './hub';

export type ResponsesToolParameters = {
  type: 'object';
  properties?: HubJsonObject;
  required?: readonly string[];
};

export type ResponsesTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters: ResponsesToolParameters;
  strict?: boolean;
};

export type ResponsesToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; name: string };

type ResponsesInputTextPart = { type: 'input_text'; text: string };
type ResponsesOutputTextPart = { type: 'output_text'; text: string };
type ResponsesInputImagePart = { type: 'input_image'; image_url: string };

export type ResponsesContentPart =
  | ResponsesInputTextPart
  | ResponsesOutputTextPart
  | ResponsesInputImagePart;

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
  id: string;
  summary?: readonly ResponsesReasoningSummaryPart[];
  encrypted_content?: string;
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
  store?: boolean;
  metadata?: HubJsonObject;
  service_tier?: string;
  top_logprobs?: number;
  truncation?: string;
  user?: string;
  parallel_tool_calls?: boolean;
  prompt_cache_key?: string;
};

import type { HubJsonObject } from './hub';

type InteractionsTextPart = { type?: 'text'; text: string };

type InteractionsImagePart = {
  type: 'image';
  uri?: string;
  data?: string;
  mime_type?: string;
};

type InteractionsFilePart = {
  type: 'file';
  uri?: string;
  data?: string;
  mime_type?: string;
  name?: string;
};

export type InteractionsContentPart =
  | InteractionsTextPart
  | InteractionsImagePart
  | InteractionsFilePart;

type InteractionsUserInput = {
  type: 'user_input';
  content: string | readonly InteractionsContentPart[];
};

type InteractionsModelOutput = {
  type: 'model_output';
  content: string | readonly InteractionsContentPart[];
};

type InteractionsThought = {
  type: 'thought';
  content?: string | readonly InteractionsContentPart[];
  signature?: string;
};

type InteractionsFunctionCall = {
  type: 'function_call';
  id?: string;
  call_id?: string;
  name: string;
  arguments: HubJsonObject | string;
  signature?: string;
};

type InteractionsFunctionResult = {
  type: 'function_result';
  call_id: string;
  name?: string;
  result: unknown;
};

export type InteractionsStep =
  | InteractionsUserInput
  | InteractionsModelOutput
  | InteractionsThought
  | InteractionsFunctionCall
  | InteractionsFunctionResult;

export type InteractionsTurn = {
  role: 'user' | 'assistant' | 'model';
  steps?: readonly InteractionsStep[];
  parts?: readonly InteractionsContentPart[];
};

export type InteractionsFunctionTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters?: HubJsonObject;
};

export type InteractionsToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string };

export type InteractionsGenerationConfig = {
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: readonly string[];
  tool_choice?: InteractionsToolChoice;
  thinking_level?: string;
  thinking_budget?: number;
  thinking_summaries?: string;
};

export type InteractionsRequest = {
  model?: string;
  input:
    | string
    | InteractionsStep
    | InteractionsTurn
    | readonly (InteractionsStep | InteractionsTurn)[];
  system_instruction?: string;
  tools?: readonly InteractionsFunctionTool[];
  generation_config?: InteractionsGenerationConfig;
  previous_interaction_id?: string;
  stream?: boolean;
  response_modalities?: readonly string[];
  service_tier?: string;
  response_format?: unknown;
};

export type InteractionsUsage = {
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;
  reasoning_tokens?: number;
};

export type InteractionsResponse = {
  id: string;
  model?: string;
  status?: string;
  steps: readonly InteractionsStep[];
  usage?: InteractionsUsage;
};

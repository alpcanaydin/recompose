import type { GeminiRefusal } from './gemini-refusal';

export type Dialect = 'anthropic' | 'chat-completions' | 'gemini' | 'interactions' | 'responses';

export type AnthropicRefusal = {
  type: 'error';
  error: {
    type: 'not_found_error' | 'permission_error' | 'invalid_request_error' | 'api_error';
    message: string;
  };
};

export type OpenAiCode =
  | 'model_not_found'
  | 'unmappable_stop_reason'
  | 'unrepairable_tool_call'
  | 'unsupported_field'
  | 'empty_conversation'
  | 'tool_id_collision'
  | 'missing_target'
  | 'missing_credential'
  | 'invalid_json';

export type OpenAiRefusal = {
  error: {
    message: string;
    type: 'invalid_request_error';
    param: null;
    code: OpenAiCode;
  };
};

export type ResponsesRefusal = {
  error: {
    message: string;
    type: 'invalid_request_error';
    code: OpenAiCode;
    param: null;
  };
};

export type RenderedRefusal = {
  status: number;
  body: AnthropicRefusal | OpenAiRefusal | ResponsesRefusal | GeminiRefusal;
};

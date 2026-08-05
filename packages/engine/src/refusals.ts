export type Dialect = 'anthropic' | 'chat-completions' | 'responses';

export type AnthropicRefusal = {
  type: 'error';
  error: {
    type: 'not_found_error' | 'permission_error' | 'invalid_request_error';
    message: string;
  };
};

type OpenAiCode =
  | 'model_not_found'
  | 'unmappable_stop_reason'
  | 'unrepairable_tool_call'
  | 'unsupported_field';

export type OpenAiRefusal = {
  error: {
    message: string;
    type: 'invalid_request_error';
    param: null;
    code: OpenAiCode;
  };
};

type ResponsesRefusal = {
  error: {
    message: string;
    type: 'invalid_request_error';
    code: OpenAiCode;
    param: null;
  };
};

export type TranslationRefusal =
  | { reason: 'unknown-model'; model: string }
  | { reason: 'unmappable-stop-reason'; stopReason: string }
  | { reason: 'unrepairable-tool-call'; unmatchedId: string }
  | { reason: 'unsupported-field'; field: string };

export type RenderedRefusal = {
  status: number;
  body: AnthropicRefusal | OpenAiRefusal | ResponsesRefusal;
};

function missingModelMessage(displayName: string): string {
  return `The gateway "${displayName}" holds no virtual model.`;
}

export function missingModelInAnthropicDialect(displayName: string): AnthropicRefusal {
  return {
    type: 'error',
    error: { type: 'not_found_error', message: missingModelMessage(displayName) },
  };
}

export function missingModelInOpenAiDialect(displayName: string): OpenAiRefusal {
  return {
    error: {
      message: missingModelMessage(displayName),
      type: 'invalid_request_error',
      param: null,
      code: 'model_not_found',
    },
  };
}

export function nonLoopbackClient(): AnthropicRefusal {
  return {
    type: 'error',
    error: {
      type: 'permission_error',
      message: 'This gateway answers loopback clients only.',
    },
  };
}

export function requestCarriesOrigin(): AnthropicRefusal {
  return {
    type: 'error',
    error: {
      type: 'permission_error',
      message:
        'This gateway refuses any request that carries an Origin header, so no web page can reach it.',
    },
  };
}

export function unservedPath(displayName: string, path: string): AnthropicRefusal {
  return {
    type: 'error',
    error: {
      type: 'not_found_error',
      message: `The gateway "${displayName}" serves no path "${path}".`,
    },
  };
}

export function unknownModel(model: string): TranslationRefusal {
  return { reason: 'unknown-model', model };
}

export function unmappableStopReason(stopReason: string): TranslationRefusal {
  return { reason: 'unmappable-stop-reason', stopReason };
}

export function unrepairableToolCall(unmatchedId: string): TranslationRefusal {
  return { reason: 'unrepairable-tool-call', unmatchedId };
}

export function unsupportedField(field: string): TranslationRefusal {
  return { reason: 'unsupported-field', field };
}

type RefusalFacts = {
  status: number;
  message: string;
  code: OpenAiCode;
  anthropicType: AnthropicRefusal['error']['type'];
};

function factsOf(refusal: TranslationRefusal): RefusalFacts {
  switch (refusal.reason) {
    case 'unknown-model':
      return {
        status: 404,
        message: `No model named "${refusal.model}" is defined.`,
        code: 'model_not_found',
        anthropicType: 'not_found_error',
      };
    case 'unmappable-stop-reason':
      return {
        status: 422,
        message: `The stop reason "${refusal.stopReason}" has no counterpart in this dialect.`,
        code: 'unmappable_stop_reason',
        anthropicType: 'invalid_request_error',
      };
    case 'unrepairable-tool-call':
      return {
        status: 422,
        message: `The tool call "${refusal.unmatchedId}" has no matching tool result, and no repair is possible.`,
        code: 'unrepairable_tool_call',
        anthropicType: 'invalid_request_error',
      };
    case 'unsupported-field':
      return {
        status: 400,
        message: `This dialect cannot carry the field "${refusal.field}".`,
        code: 'unsupported_field',
        anthropicType: 'invalid_request_error',
      };
    default:
      throw new Error(`unhandled translation refusal: ${JSON.stringify(refusal)}`);
  }
}

function anthropicBody(facts: RefusalFacts): AnthropicRefusal {
  return { type: 'error', error: { type: facts.anthropicType, message: facts.message } };
}

function chatCompletionsBody(facts: RefusalFacts): OpenAiRefusal {
  return {
    error: { message: facts.message, type: 'invalid_request_error', param: null, code: facts.code },
  };
}

function responsesBody(facts: RefusalFacts): ResponsesRefusal {
  return {
    error: { message: facts.message, type: 'invalid_request_error', code: facts.code, param: null },
  };
}

function bodyInDialect(dialect: Dialect, facts: RefusalFacts): RenderedRefusal['body'] {
  switch (dialect) {
    case 'anthropic':
      return anthropicBody(facts);
    case 'chat-completions':
      return chatCompletionsBody(facts);
    case 'responses':
      return responsesBody(facts);
    default:
      throw new Error(`unhandled dialect: ${String(dialect)}`);
  }
}

export function renderRefusal(dialect: Dialect, refusal: TranslationRefusal): RenderedRefusal {
  const facts = factsOf(refusal);

  return { status: facts.status, body: bodyInDialect(dialect, facts) };
}

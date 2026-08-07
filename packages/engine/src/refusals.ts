export type Dialect = 'anthropic' | 'chat-completions' | 'interactions' | 'responses';

export type AnthropicRefusal = {
  type: 'error';
  error: {
    type: 'not_found_error' | 'permission_error' | 'invalid_request_error' | 'api_error';
    message: string;
  };
};

type OpenAiCode =
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
  | { reason: 'unsupported-field'; field: string }
  | { reason: 'empty-conversation' }
  | { reason: 'tool-id-collision'; sanitizedId: string }
  | { reason: 'missing-target'; displayName: string; model: string }
  | { reason: 'missing-credential'; displayName: string; model: string }
  | { reason: 'invalid-json'; message: string };

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

export function emptyConversation(): TranslationRefusal {
  return { reason: 'empty-conversation' };
}

export function toolIdCollision(sanitizedId: string): TranslationRefusal {
  return { reason: 'tool-id-collision', sanitizedId };
}

export function missingTarget(displayName: string, model: string): TranslationRefusal {
  return { reason: 'missing-target', displayName, model };
}

export function missingCredential(displayName: string, model: string): TranslationRefusal {
  return { reason: 'missing-credential', displayName, model };
}

export function invalidJson(message: string): TranslationRefusal {
  return { reason: 'invalid-json', message };
}

type RefusalFacts = {
  status: number;
  message: string;
  code: OpenAiCode;
  anthropicType: AnthropicRefusal['error']['type'];
};

type ClientErrorRefusal = Extract<
  TranslationRefusal,
  { reason: 'unsupported-field' | 'empty-conversation' | 'tool-id-collision' | 'invalid-json' }
>;

function clientErrorFacts(refusal: ClientErrorRefusal): RefusalFacts {
  switch (refusal.reason) {
    case 'unsupported-field':
      return {
        status: 400,
        message: `This dialect cannot carry the field "${refusal.field}".`,
        code: 'unsupported_field',
        anthropicType: 'invalid_request_error',
      };
    case 'empty-conversation':
      return {
        status: 400,
        message: 'The request carries no message to translate.',
        code: 'empty_conversation',
        anthropicType: 'invalid_request_error',
      };
    case 'tool-id-collision':
      return {
        status: 400,
        message: `Two tool calls share the sanitized id "${refusal.sanitizedId}", so their pairing is ambiguous.`,
        code: 'tool_id_collision',
        anthropicType: 'invalid_request_error',
      };
    case 'invalid-json':
      return {
        status: 400,
        message: refusal.message,
        code: 'invalid_json',
        anthropicType: 'invalid_request_error',
      };

    default: {
      const unhandled: never = refusal;

      throw new Error(`unhandled client-error refusal: ${JSON.stringify(unhandled)}`);
    }
  }
}

type ConfigFaultRefusal = Extract<
  TranslationRefusal,
  { reason: 'missing-target' | 'missing-credential' }
>;

function configFaultFacts(refusal: ConfigFaultRefusal): RefusalFacts {
  if (refusal.reason === 'missing-target') {
    return {
      status: 502,
      message: `The gateway "${refusal.displayName}" holds no target for the virtual model "${refusal.model}".`,
      code: 'missing_target',
      anthropicType: 'api_error',
    };
  }

  return {
    status: 502,
    message: `The gateway "${refusal.displayName}" holds no credential for the virtual model "${refusal.model}".`,
    code: 'missing_credential',
    anthropicType: 'api_error',
  };
}

function isConfigFault(refusal: TranslationRefusal): refusal is ConfigFaultRefusal {
  return refusal.reason === 'missing-target' || refusal.reason === 'missing-credential';
}

function factsOf(refusal: TranslationRefusal): RefusalFacts {
  if (refusal.reason === 'unknown-model') {
    return {
      status: 404,
      message: `No model named "${refusal.model}" is defined.`,
      code: 'model_not_found',
      anthropicType: 'not_found_error',
    };
  }

  if (refusal.reason === 'unmappable-stop-reason') {
    return {
      status: 422,
      message: `The stop reason "${refusal.stopReason}" has no counterpart in this dialect.`,
      code: 'unmappable_stop_reason',
      anthropicType: 'invalid_request_error',
    };
  }

  if (refusal.reason === 'unrepairable-tool-call') {
    return {
      status: 422,
      message: `The tool call "${refusal.unmatchedId}" has no matching tool result, and no repair is possible.`,
      code: 'unrepairable_tool_call',
      anthropicType: 'invalid_request_error',
    };
  }

  if (isConfigFault(refusal)) {
    return configFaultFacts(refusal);
  }

  return clientErrorFacts(refusal);
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
    case 'interactions':
      return responsesBody(facts);
    default:
      throw new Error(`unhandled dialect: ${String(dialect)}`);
  }
}

export function renderRefusal(dialect: Dialect, refusal: TranslationRefusal): RenderedRefusal {
  const facts = factsOf(refusal);

  return { status: facts.status, body: bodyInDialect(dialect, facts) };
}

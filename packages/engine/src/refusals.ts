type AnthropicRefusal = {
  type: 'error';
  error: { type: 'not_found_error' | 'permission_error'; message: string };
};

type OpenAiRefusal = {
  error: {
    message: string;
    type: 'invalid_request_error';
    param: null;
    code: 'model_not_found';
  };
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

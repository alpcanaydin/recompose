import { describe, expect, it } from 'vitest';

import {
  emptyConversation,
  missingCredential,
  missingModelInAnthropicDialect,
  missingModelInOpenAiDialect,
  missingTarget,
  renderRefusal,
  toolIdCollision,
  unmappableStopReason,
  unknownModel,
  unrepairableToolCall,
  unsupportedField,
} from './refusals';

describe('the shipped refusal factories keep their envelopes', () => {
  it('names the missing model in the Anthropic envelope', () => {
    expect(missingModelInAnthropicDialect('Codex')).toEqual({
      type: 'error',
      error: { type: 'not_found_error', message: 'The gateway "Codex" holds no virtual model.' },
    });
  });

  it('names the missing model in the OpenAI envelope', () => {
    expect(missingModelInOpenAiDialect('Codex')).toEqual({
      error: {
        message: 'The gateway "Codex" holds no virtual model.',
        type: 'invalid_request_error',
        param: null,
        code: 'model_not_found',
      },
    });
  });
});

describe('renderRefusal renders an unknown model as a 404 in every dialect', () => {
  it('renders the anthropic envelope', () => {
    const rendered = renderRefusal('anthropic', unknownModel('fast'));

    expect(rendered.status).toBe(404);
    expect(rendered.body).toEqual({
      type: 'error',
      error: { type: 'not_found_error', message: 'No model named "fast" is defined.' },
    });
  });

  it('renders the chat-completions envelope', () => {
    const rendered = renderRefusal('chat-completions', unknownModel('fast'));

    expect(rendered.status).toBe(404);
    expect(rendered.body).toEqual({
      error: {
        message: 'No model named "fast" is defined.',
        type: 'invalid_request_error',
        param: null,
        code: 'model_not_found',
      },
    });
  });

  it('renders the responses envelope', () => {
    const rendered = renderRefusal('responses', unknownModel('fast'));

    expect(rendered.status).toBe(404);
    expect(rendered.body).toEqual({
      error: {
        message: 'No model named "fast" is defined.',
        type: 'invalid_request_error',
        code: 'model_not_found',
        param: null,
      },
    });
  });
});

describe('renderRefusal splits the other refusals by meaning', () => {
  it('renders an unmappable stop reason as a 422', () => {
    const rendered = renderRefusal('chat-completions', unmappableStopReason('pause_turn'));

    expect(rendered.status).toBe(422);
    expect(rendered.body).toEqual({
      error: {
        message: 'The stop reason "pause_turn" has no counterpart in this dialect.',
        type: 'invalid_request_error',
        param: null,
        code: 'unmappable_stop_reason',
      },
    });
  });

  it('renders an unrepairable tool call as a 422 naming the unmatched id', () => {
    const rendered = renderRefusal('anthropic', unrepairableToolCall('toolu_9'));

    expect(rendered.status).toBe(422);
    expect(rendered.body).toEqual({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'The tool call "toolu_9" has no matching tool result, and no repair is possible.',
      },
    });
  });

  it('renders an unsupported field as a 400', () => {
    const rendered = renderRefusal('anthropic', unsupportedField('previous_response_id'));

    expect(rendered.status).toBe(400);
    expect(rendered.body).toEqual({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'This dialect cannot carry the field "previous_response_id".',
      },
    });
  });
});

describe('renderRefusal renders a missing target as a 502 in both dialects', () => {
  it('names the gateway and the virtual model in the anthropic envelope', () => {
    const rendered = renderRefusal('anthropic', missingTarget('Codex', 'fast'));

    expect(rendered.status).toBe(502);
    expect(rendered.body).toEqual({
      type: 'error',
      error: {
        type: 'api_error',
        message: 'The gateway "Codex" holds no target for the virtual model "fast".',
      },
    });
  });

  it('names the gateway and the virtual model in the OpenAI envelope', () => {
    const rendered = renderRefusal('chat-completions', missingTarget('Codex', 'fast'));

    expect(rendered.status).toBe(502);
    expect(rendered.body).toEqual({
      error: {
        message: 'The gateway "Codex" holds no target for the virtual model "fast".',
        type: 'invalid_request_error',
        param: null,
        code: 'missing_target',
      },
    });
  });
});

describe('renderRefusal renders a missing credential as a 502 in both dialects', () => {
  it('names the gateway and the virtual model in the anthropic envelope', () => {
    const rendered = renderRefusal('anthropic', missingCredential('Codex', 'fast'));

    expect(rendered.status).toBe(502);
    expect(rendered.body).toEqual({
      type: 'error',
      error: {
        type: 'api_error',
        message: 'The gateway "Codex" holds no credential for the virtual model "fast".',
      },
    });
  });

  it('names the gateway and the virtual model in the OpenAI envelope', () => {
    const rendered = renderRefusal('chat-completions', missingCredential('Codex', 'fast'));

    expect(rendered.status).toBe(502);
    expect(rendered.body).toEqual({
      error: {
        message: 'The gateway "Codex" holds no credential for the virtual model "fast".',
        type: 'invalid_request_error',
        param: null,
        code: 'missing_credential',
      },
    });
  });
});

describe('renderRefusal keeps an absent model apart from broken backing', () => {
  it('answers 404 for an unknown model and 502 for each config fault', () => {
    expect(renderRefusal('anthropic', unknownModel('ghost')).status).toBe(404);
    expect(renderRefusal('anthropic', missingTarget('Codex', 'ghost')).status).toBe(502);
    expect(renderRefusal('anthropic', missingCredential('Codex', 'ghost')).status).toBe(502);
  });
});

describe('renderRefusal refuses a structurally invalid conversation as a 400', () => {
  it('renders an empty conversation as a 400 in the OpenAI envelope', () => {
    const rendered = renderRefusal('chat-completions', emptyConversation());

    expect(rendered.status).toBe(400);
    expect(rendered.body).toEqual({
      error: {
        message: 'The request carries no message to translate.',
        type: 'invalid_request_error',
        param: null,
        code: 'empty_conversation',
      },
    });
  });

  it('renders a tool-id collision as a 400 naming the shared id', () => {
    const rendered = renderRefusal('anthropic', toolIdCollision('a_1'));

    expect(rendered.status).toBe(400);
    expect(rendered.body).toEqual({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Two tool calls share the sanitized id "a_1", so their pairing is ambiguous.',
      },
    });
  });
});

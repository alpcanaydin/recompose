import { describe, expect, it } from 'vitest';

import {
  missingModelInAnthropicDialect,
  missingModelInOpenAiDialect,
  renderRefusal,
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

import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ReasoningDialect } from './reasoning-types';

import { applyReasoningIntent } from './reasoning-capability-output';

type OutputCase = {
  name: string;
  body: JsonObject;
  dialect: ReasoningDialect;
  expected: JsonObject;
};

describe('a reasoning level the caller names', () => {
  it.each<OutputCase>([
    {
      name: 'Claude turns thinking off outright',
      body: { model: 'claude-opus-4-6' },
      dialect: 'anthropic',
      expected: { model: 'claude-opus-4-6', thinking: { type: 'disabled' } },
    },
    {
      name: 'chat completions names the effort at the top level',
      body: { model: 'gpt-5' },
      dialect: 'chat-completions',
      expected: { model: 'gpt-5', reasoning_effort: 'none' },
    },
    {
      name: 'Responses records the effort beside the reasoning it already carries',
      body: { reasoning: { summary: 'auto' } },
      dialect: 'responses',
      expected: { reasoning: { summary: 'auto', effort: 'none' } },
    },
    {
      name: 'Interactions records the thinking level in its generation config',
      body: { generation_config: { temperature: 1 } },
      dialect: 'interactions',
      expected: { generation_config: { temperature: 1, thinking_level: 'none' } },
    },
    {
      name: 'Gemini records the thinking level in its nested thinking config',
      body: { generationConfig: { temperature: 1, thinkingConfig: { includeThoughts: true } } },
      dialect: 'gemini',
      expected: {
        generationConfig: {
          temperature: 1,
          thinkingConfig: { includeThoughts: true, thinkingLevel: 'none' },
        },
      },
    },
  ])('$name', ({ body, dialect, expected }) => {
    expect(applyReasoningIntent(body, dialect, { kind: 'level', level: 'none' })).toEqual(expected);
  });
});

describe('a reasoning level applied over an existing or malformed carrier', () => {
  it.each<OutputCase>([
    {
      name: 'Claude records the effort beside the output config it already carries',
      body: { output_config: { verbosity: 'low' } },
      dialect: 'anthropic',
      expected: { output_config: { verbosity: 'low', effort: 'high' } },
    },
    {
      name: 'Claude replaces an output config that is not an object',
      body: { output_config: 'loud' },
      dialect: 'anthropic',
      expected: { output_config: { effort: 'high' } },
    },
    {
      name: 'Responses replaces reasoning that is not an object',
      body: { reasoning: null },
      dialect: 'responses',
      expected: { reasoning: { effort: 'high' } },
    },
    {
      name: 'Interactions replaces a generation config that is not an object',
      body: { generation_config: 7 },
      dialect: 'interactions',
      expected: { generation_config: { thinking_level: 'high' } },
    },
    {
      name: 'Gemini replaces a thinking config that is not an object',
      body: { generationConfig: { thinkingConfig: 'deep' } },
      dialect: 'gemini',
      expected: { generationConfig: { thinkingConfig: { thinkingLevel: 'high' } } },
    },
    {
      name: 'Gemini builds the whole generation config when none exists',
      body: {},
      dialect: 'gemini',
      expected: { generationConfig: { thinkingConfig: { thinkingLevel: 'high' } } },
    },
  ])('$name', ({ body, dialect, expected }) => {
    expect(applyReasoningIntent(body, dialect, { kind: 'level', level: 'high' })).toEqual(expected);
  });
});

describe('a reasoning budget the caller names', () => {
  it.each<OutputCase>([
    {
      name: 'Claude enables thinking with the budget it was handed',
      body: { model: 'claude-opus-4-6' },
      dialect: 'anthropic',
      expected: {
        model: 'claude-opus-4-6',
        thinking: { type: 'enabled', budget_tokens: 2048 },
      },
    },
    {
      name: 'Claude keeps the rest of a thinking block it already carries',
      body: { thinking: { type: 'disabled', display: 'omitted' } },
      dialect: 'anthropic',
      expected: { thinking: { display: 'omitted', type: 'enabled', budget_tokens: 2048 } },
    },
    {
      name: 'Claude replaces a thinking block that is not an object',
      body: { thinking: 'hard' },
      dialect: 'anthropic',
      expected: { thinking: { type: 'enabled', budget_tokens: 2048 } },
    },
    {
      name: 'Interactions records the budget in its generation config',
      body: {},
      dialect: 'interactions',
      expected: { generation_config: { thinking_budget: 2048 } },
    },
    {
      name: 'Interactions keeps the generation config it already carries',
      body: { generation_config: { temperature: 1 } },
      dialect: 'interactions',
      expected: { generation_config: { temperature: 1, thinking_budget: 2048 } },
    },
    {
      name: 'Gemini records the budget in its nested thinking config',
      body: {},
      dialect: 'gemini',
      expected: { generationConfig: { thinkingConfig: { thinkingBudget: 2048 } } },
    },
  ])('$name', ({ body, dialect, expected }) => {
    expect(applyReasoningIntent(body, dialect, { kind: 'budget', budget: 2048 })).toEqual(expected);
  });
});

describe('a reasoning budget a dialect cannot carry', () => {
  it.each<ReasoningDialect>(['chat-completions', 'responses'])(
    'should leave a %s body untouched, since it carries no budget field',
    (dialect) => {
      const body: JsonObject = { model: 'gpt-5', reasoning: { effort: 'high' } };

      expect(applyReasoningIntent(body, dialect, { kind: 'budget', budget: 2048 })).toEqual(body);
    },
  );
});

describe('a reasoning intent the caller leaves open', () => {
  it.each<OutputCase>([
    {
      name: 'Claude lets the model decide how long to think',
      body: {},
      dialect: 'anthropic',
      expected: { thinking: { type: 'adaptive' } },
    },
    {
      name: 'chat completions asks for automatic effort',
      body: {},
      dialect: 'chat-completions',
      expected: { reasoning_effort: 'auto' },
    },
    {
      name: 'Responses asks for automatic effort',
      body: {},
      dialect: 'responses',
      expected: { reasoning: { effort: 'auto' } },
    },
  ])('$name', ({ body, dialect, expected }) => {
    expect(applyReasoningIntent(body, dialect, { kind: 'auto' })).toEqual(expected);
  });

  it('should treat an unsupported reasoning intent the same way as an open one', () => {
    expect(applyReasoningIntent({}, 'gemini', { kind: 'none' })).toEqual({
      generationConfig: { thinkingConfig: { thinkingLevel: 'auto' } },
    });
  });
});

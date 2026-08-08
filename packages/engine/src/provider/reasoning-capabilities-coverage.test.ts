import { describe, expect, test } from 'vitest';

import type { ReasoningCapabilities } from './reasoning-capabilities';
import type { ReasoningDialect } from './reasoning-types';

import {
  applyReasoningCapabilities,
  mapReasoningLevel,
  reasoningModelBase,
} from './reasoning-capabilities';

type Scenario = {
  capabilities?: ReasoningCapabilities;
  model: string;
  source?: Record<string, unknown>;
  sourceDialect?: ReasoningDialect;
  targetDialect?: ReasoningDialect;
};

function applied(scenario: Scenario) {
  return applyReasoningCapabilities({
    body: {},
    capabilities: scenario.capabilities ?? {},
    model: scenario.model,
    source: scenario.source ?? {},
    sourceDialect: scenario.sourceDialect ?? 'chat-completions',
    targetDialect: scenario.targetDialect ?? 'chat-completions',
  });
}

function geminiThinking(thinking: unknown): Record<string, unknown> {
  return { generationConfig: { thinkingConfig: thinking } };
}

describe('recognizing a reasoning suffix on a model name', () => {
  test('a parenthesized suffix naming no reasoning intent stays part of the model', () => {
    const result = applied({ model: 'gemini-pro(turbo)' });

    expect(result.model).toBe('gemini-pro(turbo)');
    expect(result.body).toStrictEqual({});
    expect(reasoningModelBase('gemini-pro(turbo)')).toBe('gemini-pro(turbo)');
  });

  test('a budget suffix beyond the safe integer range is not a reasoning directive', () => {
    const result = applied({ model: 'gemini-pro(99999999999999999999)' });

    expect(result.model).toBe('gemini-pro(99999999999999999999)');
    expect(result.body).toStrictEqual({});
  });

  test('a numeric suffix asks the target for that thinking budget', () => {
    const result = applied({ model: 'sonnet(2048)', targetDialect: 'anthropic' });

    expect(result.model).toBe('sonnet');
    expect(result.body).toHaveProperty('thinking.budget_tokens', 2048);
  });
});

describe('reading the reasoning effort a Gemini caller asked for', () => {
  test('a Gemini thinking level becomes the effort the target receives', () => {
    const result = applied({
      model: 'gemini-pro',
      source: geminiThinking({ thinkingLevel: 'high' }),
      sourceDialect: 'gemini',
    });

    expect(result.body).toHaveProperty('reasoning_effort', 'high');
  });

  test('a Gemini request without a generation config asks for no reasoning', () => {
    const result = applied({ model: 'gemini-pro', source: {}, sourceDialect: 'gemini' });

    expect(result.body).toStrictEqual({});
  });

  test('a Gemini generation config without a thinking config asks for no reasoning', () => {
    const result = applied({
      model: 'gemini-pro',
      source: { generationConfig: {} },
      sourceDialect: 'gemini',
    });

    expect(result.body).toStrictEqual({});
  });

  test('a non-textual Gemini thinking level asks for no reasoning', () => {
    const result = applied({
      model: 'gemini-pro',
      source: geminiThinking({ thinkingLevel: 4096 }),
      sourceDialect: 'gemini',
    });

    expect(result.body).toStrictEqual({});
  });
});

describe('carrying disabled and dynamic reasoning across dialects', () => {
  test('an effort of none reaches a model that permits disabled reasoning', () => {
    const result = applied({
      capabilities: { levels: ['none', 'low'], zeroAllowed: true },
      model: 'gpt',
      source: { reasoning_effort: 'none' },
    });

    expect(result.body).toHaveProperty('reasoning_effort', 'none');
  });

  test('an effort of auto stays dynamic on a model that supports it', () => {
    const result = applied({
      capabilities: { dynamicAllowed: true },
      model: 'gpt',
      source: { reasoning_effort: 'auto' },
      targetDialect: 'responses',
    });

    expect(result.body).toHaveProperty('reasoning.effort', 'auto');
  });
});

describe('mapping a level onto the levels a model declares', () => {
  test('a model that declares no levels accepts the requested level unchanged', () => {
    const result = applied({ model: 'gpt(high)' });

    expect(result.body).toHaveProperty('reasoning_effort', 'high');
  });

  test('an unknown level survives when no declared level sits on the known ladder', () => {
    expect(mapReasoningLevel('ultra', { levels: ['low', 'high'] }, false)).toBe('ultra');
  });

  test('a declared level outside the known ladder never wins the nearest match', () => {
    expect(mapReasoningLevel('xhigh', { levels: ['bogus', 'low'] }, false)).toBe('low');
  });
});

describe('clamping a thinking budget to what a model accepts', () => {
  test('a budget passes through untouched when the model declares no bounds', () => {
    const result = applied({ model: 'sonnet(4096)', targetDialect: 'anthropic' });

    expect(result.body).toHaveProperty('thinking.budget_tokens', 4096);
  });

  test('a zero budget rises to the minimum when the model refuses to stop thinking', () => {
    const result = applied({
      capabilities: { minBudget: 1024, zeroAllowed: false },
      model: 'sonnet(0)',
      targetDialect: 'anthropic',
    });

    expect(result.body).toHaveProperty('thinking.budget_tokens', 1024);
  });
});

describe('normalizing none and auto for a model that speaks only budgets', () => {
  test('disabling reasoning falls back to the smallest budget the model accepts', () => {
    const result = applied({
      capabilities: { minBudget: 128 },
      model: 'sonnet(none)',
      targetDialect: 'anthropic',
    });

    expect(result.body).toHaveProperty('thinking.budget_tokens', 128);
  });

  test('dynamic reasoning lands midway through the budget range the model declares', () => {
    const result = applied({
      capabilities: { maxBudget: 5000, minBudget: 1000 },
      model: 'sonnet(auto)',
      targetDialect: 'anthropic',
    });

    expect(result.body).toHaveProperty('thinking.budget_tokens', 3000);
  });

  test('dynamic reasoning on a model that declares nothing spends no budget', () => {
    const result = applied({ model: 'sonnet(auto)', targetDialect: 'anthropic' });

    expect(result.body).toHaveProperty('thinking.budget_tokens', 0);
  });
});

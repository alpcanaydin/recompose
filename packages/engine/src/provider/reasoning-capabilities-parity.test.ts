import { describe, expect, test } from 'vitest';

import type { ReasoningCapabilities } from './reasoning-capabilities';

import { applyReasoningCapabilities } from './reasoning-capabilities';

function applied(
  source: Record<string, unknown>,
  body: Record<string, unknown>,
  capabilities: ReasoningCapabilities,
  sourceDialect: 'anthropic' | 'chat-completions' | 'responses',
  targetDialect: 'anthropic' | 'chat-completions' | 'responses',
  model = 'upstream-model',
  strict?: boolean,
) {
  return applyReasoningCapabilities({
    body,
    capabilities,
    model,
    source,
    sourceDialect,
    ...(strict === undefined ? {} : { strict }),
    targetDialect,
  });
}

describe('cross-family reasoning level mapping', () => {
  test('TestApplyThinkingWithModelInfoMapsCrossFamilyHighIntent', () => {
    const cases = [
      ['xhigh', ['high', 'max', 'xhigh'], 'xhigh'],
      ['xhigh', ['high', 'max'], 'max'],
      ['xhigh', ['high'], 'high'],
      ['max', ['high', 'xhigh', 'max'], 'max'],
      ['max', ['high', 'xhigh'], 'xhigh'],
      ['max', ['high'], 'high'],
    ] as const;

    for (const [source, levels, expected] of cases) {
      const result = applied(
        { reasoning_effort: source },
        { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
        { levels },
        'chat-completions',
        'anthropic',
      );

      expect(result.body).toHaveProperty('output_config.effort', expected);
    }
  });

  test('TestApplyThinkingWithModelInfoMapsOpenAICompatibilityHighIntent', () => {
    const result = applied(
      { reasoning_effort: 'xhigh' },
      { reasoning_effort: 'high' },
      { levels: ['high', 'max'] },
      'chat-completions',
      'chat-completions',
      'upstream-model',
      false,
    );

    expect(result.body).toHaveProperty('reasoning_effort', 'max');
  });

  test('TestApplyThinkingWithModelInfoMapsResponsesToCodexHighIntent', () => {
    const result = applied(
      { reasoning: { effort: 'max' } },
      { reasoning: { effort: 'high' } },
      { levels: ['high', 'xhigh'] },
      'responses',
      'responses',
      'upstream-model',
      false,
    );

    expect(result.body).toHaveProperty('reasoning.effort', 'xhigh');
  });
});

describe('strict and suffix reasoning application', () => {
  test('TestApplyThinkingWithModelInfoKeepsSameFamilyValidationStrict', () => {
    expect(() =>
      applied(
        { reasoning_effort: 'xhigh' },
        { reasoning_effort: 'xhigh' },
        { levels: ['low', 'medium', 'high'] },
        'chat-completions',
        'chat-completions',
      ),
    ).toThrow('Unsupported reasoning level "xhigh"');
  });

  test('TestApplyThinkingWithSummaryKeepsOpenAIChatSuffixNone', () => {
    const result = applied(
      { reasoning: { summary: 'auto' } },
      { messages: [] },
      { levels: ['none', 'low', 'high'], zeroAllowed: true },
      'responses',
      'chat-completions',
      'private-openai(none)',
    );

    expect(result.model).toBe('private-openai');
    expect(result.body).toHaveProperty('reasoning_effort', 'none');
  });

  test('TestApplyThinkingWithModelInfoUsesOriginalResponsesEffort', () => {
    const result = applied(
      { reasoning: { effort: 'xhigh' } },
      { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
      { levels: ['high', 'max'] },
      'responses',
      'anthropic',
    );

    expect(result.body).toHaveProperty('output_config.effort', 'max');
  });
});

describe('reasoning capability limits', () => {
  test('normalizes dynamic, zero, and budget intents to model capabilities', () => {
    const auto = applied(
      {},
      {},
      { dynamicAllowed: false, levels: ['low', 'high'] },
      'responses',
      'anthropic',
      'model(auto)',
    );
    const none = applied(
      {},
      {},
      { levels: ['low', 'high'], zeroAllowed: false },
      'responses',
      'chat-completions',
      'model(none)',
    );
    const budget = applied(
      {},
      {},
      { maxBudget: 16_000, minBudget: 1024 },
      'responses',
      'anthropic',
      'model(100)',
    );

    expect(auto.body).toHaveProperty('output_config.effort', 'low');
    expect(none.body).toHaveProperty('reasoning_effort', 'low');
    expect(budget.body).toHaveProperty('thinking.budget_tokens', 1024);
  });
});

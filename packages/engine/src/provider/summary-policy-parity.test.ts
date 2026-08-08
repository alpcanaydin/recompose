import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import {
  applySummaryConfig,
  applySummaryFromSource,
  applySummaryPolicy,
  extractSummaryConfig,
  extractExplicitSummaryConfig,
} from './summary-policy';

describe('summary policy crossing provider families', () => {
  test('TestApplyThinkingWithModelInfoAppliesEnabledSummaryOnlyClaudeVisibility', () => {
    const result = applySummaryFromSource(
      { model: 'claude-opus-5', max_tokens: 32_000 },
      { reasoning: { summary: 'auto' } },
      'responses',
      'anthropic',
      { model: 'claude-opus-5' },
    );

    expect(result.body).toMatchObject({
      thinking: { type: 'adaptive', display: 'summarized' },
    });
    expect(result.inferredClaudeThinking).toBe(true);
  });

  test('TestApplyThinkingWithModelInfoAndSummaryDropsInferredClaudeModeWhenSummaryRemoved', () => {
    const enabled = applySummaryConfig(
      { model: 'claude-haiku-4-5-20251001', max_tokens: 32_000 },
      'anthropic',
      { mode: 'enabled' },
      { model: 'claude-haiku-4-5-20251001' },
    );
    const removed = applySummaryPolicy(
      enabled.body,
      'anthropic',
      { mode: 'unspecified' },
      {
        inferredClaudeThinking: enabled.inferredClaudeThinking,
        model: 'claude-haiku-4-5-20251001',
      },
    );

    expect(removed.body).not.toHaveProperty('thinking');
  });

  test('TestApplyThinkingWithModelInfoUsesOpenRouterVisibility', () => {
    const result = applySummaryFromSource(
      { model: 'openrouter-model', messages: [] },
      { reasoning: { summary: 'auto' } },
      'responses',
      'chat-completions',
      { provider: 'openrouter' },
    );

    expect(result.body).toHaveProperty('reasoning.exclude', false);
    expect(result.body).not.toHaveProperty('reasoning_effort');
  });
});

describe('summary configuration extraction', () => {
  test('TestExtractSummaryConfig', () => {
    const cases: [JsonObject, Parameters<typeof extractSummaryConfig>[1], unknown][] = [
      [{ reasoning_effort: 'high' }, 'chat-completions', { mode: 'enabled', detail: 'auto' }],
      [{ reasoning_effort: 'none' }, 'chat-completions', { mode: 'disabled' }],
      [
        {
          reasoning_effort: 'high',
          extra_body: { google: { thinking_config: { include_thoughts: false } } },
        },
        'chat-completions',
        { mode: 'disabled' },
      ],
      [{ reasoning: { summary: 'concise' } }, 'responses', { mode: 'enabled', detail: 'concise' }],
      [{ reasoning: { summary: null } }, 'responses', { mode: 'disabled' }],
      [
        { thinking: { type: 'enabled', budget_tokens: 2048, display: 'omitted' } },
        'anthropic',
        { mode: 'disabled' },
      ],
      [
        { generationConfig: { thinkingConfig: { includeThoughts: true } } },
        'gemini',
        { mode: 'enabled', detail: 'auto' },
      ],
      [{ generation_config: { thinking_summaries: 'none' } }, 'interactions', { mode: 'disabled' }],
    ];

    for (const [body, format, expected] of cases) {
      expect(extractSummaryConfig(body, format)).toEqual(expected);
    }
  });

  test('TestExtractExplicitSummaryConfigDoesNotUseChatEffort', () => {
    expect(extractExplicitSummaryConfig({ reasoning_effort: 'high' }, 'chat-completions')).toEqual({
      mode: 'unspecified',
    });
    expect(
      extractExplicitSummaryConfig(
        { reasoning_effort: 'high', reasoning: { exclude: true } },
        'chat-completions',
      ),
    ).toEqual({ mode: 'disabled' });
  });
});

describe('summary configuration application across providers', () => {
  test('TestApplySummaryConfig', () => {
    expect(applySummaryPolicy({}, 'gemini', { mode: 'enabled' }).body).toHaveProperty(
      'generationConfig.thinkingConfig.includeThoughts',
      true,
    );
    expect(applySummaryPolicy({}, 'antigravity', { mode: 'disabled' }).body).toHaveProperty(
      'request.generationConfig.thinkingConfig.includeThoughts',
      false,
    );
    expect(
      applySummaryPolicy({}, 'interactions', { mode: 'enabled', detail: 'detailed' }).body,
    ).toHaveProperty('generation_config.thinking_summaries', 'auto');
    expect(
      applySummaryPolicy({}, 'responses', { mode: 'enabled', detail: 'concise' }).body,
    ).toHaveProperty('reasoning.summary', 'concise');
  });

  test('TestApplySummaryConfig_OpenAIChatProviderDialects', () => {
    expect(
      applySummaryPolicy({}, 'chat-completions', { mode: 'enabled' }, { provider: 'openai' }).body,
    ).not.toHaveProperty('reasoning');
    expect(
      applySummaryPolicy({}, 'chat-completions', { mode: 'enabled' }, { provider: 'openrouter' })
        .body,
    ).toHaveProperty('reasoning.exclude', false);
    expect(
      applySummaryPolicy(
        { reasoning_effort: 'max' },
        'chat-completions',
        { mode: 'disabled' },
        { provider: 'kimi' },
      ).body,
    ).toHaveProperty('reasoning_effort', 'max');
  });
});

describe('summary configuration application for Claude and Responses', () => {
  test('TestApplySummaryConfig_ClaudeDisplayRequiresActiveThinking', () => {
    for (const body of [
      {},
      { messages: [{ role: 'user', content: 'hi' }] },
      { thinking: { type: 'disabled' } },
    ]) {
      expect(applySummaryPolicy(body, 'anthropic', { mode: 'disabled' }).body).toEqual(body);
    }
  });

  test('TestApplySummaryConfigForModel_ClaudeEnabledSummaryUsesValidThinkingMode', () => {
    const adaptive = applySummaryConfig(
      {},
      'anthropic',
      { mode: 'enabled' },
      {
        model: 'claude-opus-5',
      },
    );
    const manual = applySummaryConfig(
      {},
      'anthropic',
      { mode: 'enabled' },
      {
        model: 'claude-haiku-4-5-20251001',
      },
    );

    expect(adaptive.body).toHaveProperty('thinking', {
      type: 'adaptive',
      display: 'summarized',
    });
    expect(manual.body).toHaveProperty('thinking', {
      type: 'enabled',
      budget_tokens: 1024,
      display: 'summarized',
    });
  });
});

describe('Responses summary field normalization', () => {
  test('TestApplySummaryConfig_ResponsesNormalizesDeprecatedGenerateSummary', () => {
    const result = applySummaryPolicy(
      { reasoning: { generate_summary: 'detailed' } },
      'responses',
      { mode: 'enabled', detail: 'detailed' },
    ).body;

    expect(result).toHaveProperty('reasoning.summary', 'detailed');
    expect(result).not.toHaveProperty('reasoning.generate_summary');
  });

  test('TestApplySummaryConfig_ResponsesDisabledOmitsSummary', () => {
    const result = applySummaryPolicy(
      { reasoning: { effort: 'high', summary: 'auto' } },
      'responses',
      { mode: 'disabled' },
    ).body;

    expect(result).toHaveProperty('reasoning.effort', 'high');
    expect(result).not.toHaveProperty('reasoning.summary');
  });

  test('TestApplySummaryConfig_ResponsesDisabledDropsEmptyReasoning', () => {
    const result = applySummaryPolicy(
      { model: 'gpt-5.4', reasoning: { summary: 'auto' } },
      'responses',
      { mode: 'disabled' },
    ).body;

    expect(result).not.toHaveProperty('reasoning');
  });
});

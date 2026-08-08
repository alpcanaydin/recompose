import { describe, expect, it } from 'vitest';

import type { SummaryConfig } from './summary-policy-types';

import { applySummaryPolicy } from './summary-policy-apply';

function enabledWithDetail(detail: string | undefined): SummaryConfig {
  return { mode: 'enabled', ...(detail === undefined ? {} : { detail }) };
}

describe('a summary policy the caller never states outside Claude', () => {
  it('should leave the body untouched', () => {
    const body = { model: 'gpt-5' };

    expect(applySummaryPolicy(body, 'responses', { mode: 'unspecified' })).toEqual({
      body,
      inferredClaudeThinking: false,
    });
  });
});

describe('a summary policy on the chat completions wire', () => {
  it('should exclude reasoning for an OpenRouter target when summaries are disabled', () => {
    const result = applySummaryPolicy(
      { model: 'x' },
      'chat-completions',
      { mode: 'disabled' },
      { provider: 'OpenRouter' },
    );

    expect(result.body).toEqual({ model: 'x', reasoning: { exclude: true } });
  });

  it('should add no reasoning block for a target that never excludes it', () => {
    const result = applySummaryPolicy(
      { model: 'x' },
      'chat-completions',
      { mode: 'enabled' },
      { provider: 'together' },
    );

    expect(result.body).toEqual({ model: 'x' });
  });

  it('should flip an exclude flag and a reasoning switch the caller already set', () => {
    const result = applySummaryPolicy(
      { reasoning: { exclude: true, effort: 'high' }, include_reasoning: false },
      'chat-completions',
      { mode: 'enabled' },
    );

    expect(result.body).toEqual({
      reasoning: { exclude: false, effort: 'high' },
      include_reasoning: true,
    });
  });

  it('should replace a reasoning field that is not an object', () => {
    const result = applySummaryPolicy(
      { reasoning: 'high' },
      'chat-completions',
      { mode: 'enabled' },
      { provider: 'openrouter' },
    );

    expect(result.body).toEqual({ reasoning: { exclude: false } });
  });
});

describe('a summary policy on the Gemini wire', () => {
  it('should merge both generation config spellings into the camel one', () => {
    const result = applySummaryPolicy(
      {
        generation_config: { temperature: 0.5, thinking_config: { thinkingBudget: 512 } },
        generationConfig: { topP: 0.9 },
      },
      'gemini',
      { mode: 'enabled' },
    );

    expect(result.body).toEqual({
      generationConfig: {
        temperature: 0.5,
        thinking_config: { thinkingBudget: 512 },
        topP: 0.9,
        thinkingConfig: { thinkingBudget: 512, includeThoughts: true },
      },
    });
  });

  it('should drop the thought flag under either spelling before restating it', () => {
    const result = applySummaryPolicy(
      {
        generationConfig: {
          thinkingConfig: { include_thoughts: true, includeThoughts: true, thinkingBudget: 1 },
        },
      },
      'gemini',
      { mode: 'disabled' },
    );

    expect(result.body).toEqual({
      generationConfig: { thinkingConfig: { thinkingBudget: 1, includeThoughts: false } },
    });
  });

  it('should build the generation config when the body carries neither spelling', () => {
    const result = applySummaryPolicy({ contents: [] }, 'gemini', { mode: 'enabled' });

    expect(result.body).toEqual({
      contents: [],
      generationConfig: { thinkingConfig: { includeThoughts: true } },
    });
  });

  it('should replace a generation config that is not an object', () => {
    const result = applySummaryPolicy({ generationConfig: 'fast' }, 'gemini', { mode: 'enabled' });

    expect(result.body).toEqual({
      generationConfig: { thinkingConfig: { includeThoughts: true } },
    });
  });
});

describe('a summary policy on the Antigravity wire', () => {
  it('should reach inside the request envelope the caller sent', () => {
    const result = applySummaryPolicy({ request: { contents: [] }, project: 'p' }, 'antigravity', {
      mode: 'enabled',
    });

    expect(result.body).toEqual({
      project: 'p',
      request: { contents: [], generationConfig: { thinkingConfig: { includeThoughts: true } } },
    });
  });

  it('should build a request envelope when the body carries none', () => {
    const result = applySummaryPolicy({ project: 'p' }, 'antigravity', { mode: 'disabled' });

    expect(result.body).toEqual({
      project: 'p',
      request: { generationConfig: { thinkingConfig: { includeThoughts: false } } },
    });
  });
});

describe('a summary policy on the Interactions wire', () => {
  it('should replace the alias spelling with automatic thinking summaries', () => {
    const result = applySummaryPolicy(
      { generation_config: { thinkingSummaries: 'auto', temperature: 1 } },
      'interactions',
      { mode: 'enabled' },
    );

    expect(result.body).toEqual({
      generation_config: { temperature: 1, thinking_summaries: 'auto' },
    });
  });

  it('should turn thinking summaries off when the body carries no generation config', () => {
    const result = applySummaryPolicy({}, 'interactions', { mode: 'disabled' });

    expect(result.body).toEqual({ generation_config: { thinking_summaries: 'none' } });
  });
});

describe('a summary policy on the Responses wire', () => {
  it.each([
    ['concise', 'concise'],
    ['detailed', 'detailed'],
    ['verbose', 'auto'],
    [undefined, 'auto'],
  ])('should turn a %s detail request into a %s summary', (detail, expected) => {
    const result = applySummaryPolicy(
      { reasoning: { effort: 'high', summary: 'auto', generate_summary: 'concise' } },
      'responses',
      enabledWithDetail(detail),
    );

    expect(result.body).toEqual({ reasoning: { effort: 'high', summary: expected } });
  });

  it('should keep the rest of the reasoning block when summaries are disabled', () => {
    const result = applySummaryPolicy(
      { reasoning: { effort: 'high', summary: 'auto' } },
      'responses',
      { mode: 'disabled' },
    );

    expect(result.body).toEqual({ reasoning: { effort: 'high' } });
  });

  it('should drop a reasoning block left empty once the summary is removed', () => {
    const result = applySummaryPolicy(
      { model: 'gpt-5', reasoning: { summary: 'auto' } },
      'responses',
      { mode: 'disabled' },
    );

    expect(result.body).toEqual({ model: 'gpt-5' });
  });
});

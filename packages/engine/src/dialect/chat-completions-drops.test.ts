import { describe, expect, it } from 'vitest';

import { chatCompletionsDrops } from './chat-completions-drops';

describe('the Chat Completions vendor drop table lifts the ignored fields verbatim', () => {
  it('names every field Anthropic marks ignored on the OpenAI compatibility table', () => {
    const fields = chatCompletionsDrops.map((drop) => drop.field);

    expect(fields).toEqual(
      expect.arrayContaining([
        'logprobs',
        'top_logprobs',
        'metadata',
        'response_format',
        'prediction',
        'presence_penalty',
        'frequency_penalty',
        'seed',
        'service_tier',
        'logit_bias',
        'store',
        'user',
        'reasoning_effort',
        'modalities',
        'audio',
      ]),
    );
  });

  it('names each field once, so no drop is recorded twice', () => {
    const fields = chatCompletionsDrops.map((drop) => drop.field);

    expect(new Set(fields).size).toBe(fields.length);
  });

  it('flags the audio losses as cost-bearing, since stripping audio changes behavior', () => {
    const costBearing = chatCompletionsDrops
      .filter((drop) => drop.costBearing)
      .map((drop) => drop.field);

    expect(costBearing).toEqual(expect.arrayContaining(['audio', 'modalities']));
  });

  it('leaves the pure-metadata drops free of cost, since dropping them changes no bill', () => {
    const seed = chatCompletionsDrops.find((drop) => drop.field === 'seed');
    const logprobs = chatCompletionsDrops.find((drop) => drop.field === 'logprobs');

    expect(seed?.costBearing).toBe(false);
    expect(logprobs?.costBearing).toBe(false);
  });
});

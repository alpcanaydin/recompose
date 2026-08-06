import { describe, expect, it } from 'vitest';

import { anthropicDrops } from './anthropic-drops';

describe('the Anthropic vendor drop table names what the hub cannot carry', () => {
  it('names every envelope field the Messages schema carries and the hub cannot', () => {
    const fields = anthropicDrops.map((drop) => drop.field);

    expect(fields).toEqual(
      expect.arrayContaining([
        'top_k',
        'metadata',
        'thinking',
        'container',
        'inference_geo',
        'output_config',
        'cache_control',
      ]),
    );
  });

  it('names each field once, so no drop is recorded twice', () => {
    const fields = anthropicDrops.map((drop) => drop.field);

    expect(new Set(fields).size).toBe(fields.length);
  });

  it('flags the drops that change the bill as cost-bearing', () => {
    const costBearing = anthropicDrops.filter((drop) => drop.costBearing).map((drop) => drop.field);

    expect(costBearing).toEqual(
      expect.arrayContaining(['thinking', 'output_config', 'cache_control']),
    );
  });

  it('leaves the pure-metadata drops free of cost, since dropping them changes no bill', () => {
    const topK = anthropicDrops.find((drop) => drop.field === 'top_k');
    const metadata = anthropicDrops.find((drop) => drop.field === 'metadata');

    expect(topK?.costBearing).toBe(false);
    expect(metadata?.costBearing).toBe(false);
  });
});

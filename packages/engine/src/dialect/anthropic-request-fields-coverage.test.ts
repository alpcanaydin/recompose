import { describe, expect, it } from 'vitest';

import type { Fate } from './fates';
import type { HubRequest } from './hub';

import { decodeRequest } from './anthropic-request';
import { anAnthropicAsk } from './anthropic.testkit';

type Decoded = { value: HubRequest; fates: readonly Fate[] };

function decoded(overrides: Parameters<typeof anAnthropicAsk>[0]): Decoded {
  const result = decodeRequest(anAnthropicAsk(overrides));

  if ('refusal' in result) throw new Error('the Anthropic request was refused');

  return result;
}

function fateFields(fates: readonly Fate[]): string[] {
  return fates.map((fate) => fate.field);
}

describe('an Anthropic system prompt that survives none of its blocks', () => {
  it('leaves the hub request without a system prompt', () => {
    const { value } = decoded({
      system: [{ type: 'text', text: 'x-anthropic-billing-header: team-42' }],
    });

    expect(value.system).toBeUndefined();
  });

  it('keeps a marker block that carries no text as an empty marked entry', () => {
    const { value } = decoded({
      system: [{ type: 'search_result_location', cache_control: { type: 'ephemeral' } }],
    });

    expect(value.system).toEqual([
      { text: '', markerType: 'search_result_location', cacheBreakpoint: { type: 'ephemeral' } },
    ]);
  });
});

describe('an Anthropic tool that declares no input schema', () => {
  it('records a server tool the hub cannot carry as dropped', () => {
    const { value, fates } = decoded({
      tools: [{ name: 'code_execution', type: 'code_execution_20250522' }],
    });

    expect(value.tools).toEqual([]);
    expect(fateFields(fates)).toContain('tools[server]');
    expect(fates.find((fate) => fate.field === 'tools[server]')).toMatchObject({ to: 'absent' });
  });
});

describe('Anthropic thinking asked for without a budget', () => {
  it('carries the reasoning summary and names no budget', () => {
    const { value } = decoded({ thinking: { type: 'enabled' } });

    expect(value.reasoning).toEqual({ summary: 'auto' });
  });
});

describe('an Anthropic envelope field the hub drops at a cost', () => {
  it('marks the dropped output config as cost bearing', () => {
    const { fates } = decoded({ output_config: { verbosity: 'low' } });

    expect(fates).toContainEqual({
      field: 'output_config',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

import { describe, expect, it } from 'vitest';

import { anAnthropicAsk, anAnthropicTool, decodedValue } from './anthropic.testkit';
import { accountForEveryKey } from './fates';

describe('decodeRequest reads a real Claude Code wire body into the hub', () => {
  it('decodes string content into exactly messages and sampling', () => {
    const { value } = decodedValue(anAnthropicAsk());

    expect(value).toStrictEqual({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'What is the weather in Paris?' }] },
      ],
      sampling: { maxOutputTokens: 1024 },
    });
  });

  it('carries max_tokens into the hub sampling ceiling', () => {
    const { value } = decodedValue(anAnthropicAsk({ max_tokens: 32000 }));

    expect(value.sampling?.maxOutputTokens).toBe(32000);
  });

  it('carries a system block array with its cache_control breakpoint', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        system: [
          { type: 'text', text: 'You are Claude Code.', cache_control: { type: 'ephemeral' } },
        ],
      }),
    );

    expect(value.system).toEqual([
      { text: 'You are Claude Code.', cacheBreakpoint: { type: 'ephemeral' } },
    ]);
  });

  it('reads a plain string system into one hub system text', () => {
    const { value } = decodedValue(anAnthropicAsk({ system: 'Answer briefly.' }));

    expect(value.system).toEqual([{ text: 'Answer briefly.' }]);
  });
});

describe('decodeRequest carries the tool surface', () => {
  it('carries a tool with its input_schema into the hub schema', () => {
    const { value } = decodedValue(anAnthropicAsk({ tools: [anAnthropicTool()] }));

    expect(value.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Look up the weather for a city',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
    ]);
  });
});

describe('decodeRequest carries the web-search server tool surface', () => {
  it('carries a Codex-compatible web-search server tool and its choice', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({
        tools: [
          anAnthropicTool(),
          {
            type: 'web_search_20250305',
            name: 'web_search',
            allowed_domains: ['example.com'],
            blocked_domains: ['blocked.example'],
            user_location: { type: 'approximate', city: 'Istanbul', country: 'TR' },
          },
        ],
        tool_choice: { type: 'tool', name: 'web_search' },
      }),
    );

    expect(value.tools).toHaveLength(1);
    expect(value.serverTools).toEqual([
      {
        type: 'web_search',
        name: 'web_search',
        allowedDomains: ['example.com'],
        userLocation: { type: 'approximate', city: 'Istanbul', country: 'TR' },
      },
    ]);
    expect(value.toolChoice).toEqual({ type: 'web_search' });
    expect(fates).toContainEqual({
      field: 'tools[server]',
      disposition: 'mapped',
      to: 'serverTools',
    });
  });
});

describe('decodeRequest carries a minimal tool surface', () => {
  it('carries a bare tool without inventing a description or required list', () => {
    const { value } = decodedValue(
      anAnthropicAsk({ tools: [{ name: 'bash', input_schema: { type: 'object' } }] }),
    );

    expect(value.tools).toStrictEqual([
      { name: 'bash', inputSchema: { type: 'object', properties: {} } },
    ]);
  });
});

describe('decodeRequest maps the tool choice onto the hub vocabulary', () => {
  it('maps the any tool choice onto the hub required choice', () => {
    const { value } = decodedValue(anAnthropicAsk({ tool_choice: { type: 'any' } }));

    expect(value.toolChoice).toEqual({ type: 'required' });
  });

  it.each([
    [{ type: 'auto' } as const, { type: 'auto' }],
    [{ type: 'none' } as const, { type: 'none' }],
    [{ type: 'tool', name: 'get_weather' } as const, { type: 'tool', name: 'get_weather' }],
  ])('maps the wire tool choice %j onto its hub counterpart', (wire, hub) => {
    const { value } = decodedValue(anAnthropicAsk({ tool_choice: wire }));

    expect(value.toolChoice).toEqual(hub);
  });

  it('maps disable_parallel_tool_use onto the hub', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({ tool_choice: { type: 'auto', disable_parallel_tool_use: true } }),
    );

    expect(value.parallelToolCalls).toBe(false);
    expect(fates).toContainEqual({
      field: 'tool_choice.disable_parallel_tool_use',
      disposition: 'mapped',
      to: 'parallelToolCalls',
    });
  });
});

describe('decodeRequest maps the sampling knobs', () => {
  it('maps temperature, top_p, and stop_sequences into the hub sampling', () => {
    const { value } = decodedValue(
      anAnthropicAsk({ temperature: 0.4, top_p: 0.9, stop_sequences: ['\n\n'] }),
    );

    expect(value.sampling).toEqual({
      maxOutputTokens: 1024,
      temperature: 0.4,
      topP: 0.9,
      stop: ['\n\n'],
    });
  });

  it('injects the default ceiling when the wire body names no max_tokens', () => {
    const { value, fates } = decodedValue({ messages: [{ role: 'user', content: 'hello' }] });

    expect(value.sampling?.maxOutputTokens).toBe(4096);
    expect(fates).toContainEqual({
      field: 'max_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens (default)',
    });
  });
});

describe('decodeRequest maps Codex subscription priority', () => {
  it.each([
    [{ service_tier: 'priority' }, 'priority'],
    [{ service_tier: 'fast' }, 'priority'],
    [{ speed: 'fast' }, 'priority'],
    [{ service_tier: 'default' }, undefined],
  ] as const)('maps %j to %s', (wire, expected) => {
    const { value } = decodedValue(anAnthropicAsk(wire));

    expect(value.serviceTier).toBe(expected);
  });
});

describe('decodeRequest accounts for every source field', () => {
  it('drops a vendor field the hub cannot carry, recording its fate', () => {
    const { fates } = decodedValue(anAnthropicAsk({ top_k: 5 }));

    expect(fates).toContainEqual({ field: 'top_k', disposition: 'mapped', to: 'absent' });
  });

  it('maps the thinking configuration into provider-neutral reasoning', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({ thinking: { type: 'enabled', budget_tokens: 8_000 } }),
    );

    expect(fates).toContainEqual({
      field: 'thinking',
      disposition: 'mapped',
      to: 'reasoning',
    });
    expect(value.reasoning).toEqual({ summary: 'auto', budgetTokens: 8_000 });
  });
});

describe('decodeRequest writes the ledger whole', () => {
  it('names every top-level source field with a fate, so nothing vanishes untraced', () => {
    const request = anAnthropicAsk({
      system: 'You answer concisely.',
      tools: [anAnthropicTool()],
      tool_choice: { type: 'auto' },
      temperature: 0.4,
      top_p: 0.9,
      stop_sequences: ['\n\n'],
      metadata: { user_id: 'session-40d1' },
    });

    const { fates } = decodedValue(request);

    expect(accountForEveryKey(Object.keys(request), fates)).toEqual([]);
  });

  it('writes the full ledger of a loaded ask, each field under its named fate', () => {
    const { fates } = decodedValue(
      anAnthropicAsk({
        system: 'You answer concisely.',
        tools: [anAnthropicTool()],
        tool_choice: { type: 'auto' },
        temperature: 0.4,
        top_p: 0.9,
        stop_sequences: ['\n\n'],
        metadata: { user_id: 'session-40d1' },
      }),
    );

    expect(fates).toStrictEqual([
      { field: 'messages', disposition: 'mapped', to: 'messages' },
      { field: 'model', disposition: 'carried' },
      { field: 'metadata', disposition: 'mapped', to: 'absent' },
      { field: 'system', disposition: 'carried' },
      { field: 'tools', disposition: 'carried' },
      { field: 'tool_choice', disposition: 'mapped', to: 'toolChoice' },
      { field: 'max_tokens', disposition: 'mapped', to: 'sampling.maxOutputTokens' },
      { field: 'temperature', disposition: 'mapped', to: 'sampling.temperature' },
      { field: 'top_p', disposition: 'mapped', to: 'sampling.topP' },
      { field: 'stop_sequences', disposition: 'mapped', to: 'sampling.stop' },
    ]);
  });
});

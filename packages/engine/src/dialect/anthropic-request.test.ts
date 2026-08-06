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

  it('folds a server tool away with a recorded fate rather than crossing it', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({
        tools: [anAnthropicTool(), { type: 'web_search_20250305', name: 'web_search' }],
      }),
    );

    expect(value.tools).toHaveLength(1);
    expect(fates).toContainEqual({ field: 'tools[server]', disposition: 'mapped', to: 'absent' });
  });

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

  it('notes a dropped disable_parallel_tool_use the hub cannot carry', () => {
    const { fates } = decodedValue(
      anAnthropicAsk({ tool_choice: { type: 'auto', disable_parallel_tool_use: true } }),
    );

    expect(fates).toContainEqual({
      field: 'tool_choice.disable_parallel_tool_use',
      disposition: 'mapped',
      to: 'absent',
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

describe('decodeRequest accounts for every source field', () => {
  it('drops a vendor field the hub cannot carry, recording its fate', () => {
    const { fates } = decodedValue(anAnthropicAsk({ top_k: 5 }));

    expect(fates).toContainEqual({ field: 'top_k', disposition: 'mapped', to: 'absent' });
  });

  it('drops the thinking configuration with a recorded fate', () => {
    const { fates } = decodedValue(
      anAnthropicAsk({ thinking: { type: 'enabled', budget_tokens: 2048 } }),
    );

    expect(fates).toContainEqual({ field: 'thinking', disposition: 'mapped', to: 'absent' });
  });

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

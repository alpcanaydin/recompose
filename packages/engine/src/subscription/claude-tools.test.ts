import { describe, expect, test } from 'vitest';

import { restoreClaudeToolBody, restoreClaudeToolSseLine } from './claude-tool-response';
import { claudeMcpAlias, prepareClaudeTools } from './claude-tools';

function aliasFor(reverse: Record<string, string>, original: string): string | undefined {
  return Object.entries(reverse).find((entry) => entry[1] === original)?.[0];
}

const customToolRequest = {
  tools: [
    { type: 'web_search_20250305', name: 'web_search', max_uses: 2 },
    { name: 'Bash', description: 'shell', input_schema: { type: 'object' } },
    { type: 'custom', name: 'search_web', input_schema: { type: 'object' } },
    { name: 'Search_Web', input_schema: { type: 'object' } },
    { name: 'mcp__context7__query-docs', input_schema: { type: 'object' } },
  ],
  tool_choice: { type: 'tool', name: 'search_web' },
  messages: [
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'one', name: 'search_web', input: {} },
        { type: 'tool_reference', tool_name: 'Search_Web' },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'one',
          content: [{ type: 'tool_reference', tool_name: 'search_web' }],
        },
      ],
    },
  ],
};

describe('Claude OAuth MCP alias identity', () => {
  test('are deterministic, caller-scoped, collision-sensitive, semantic, and wire-bounded', () => {
    const first = claudeMcpAlias('caller', 'search.网页/tool with spaces');

    expect(claudeMcpAlias('caller', 'search.网页/tool with spaces')).toBe(first);
    expect(claudeMcpAlias('other', 'search.网页/tool with spaces')).not.toBe(first);
    expect(claudeMcpAlias('caller', 'search.网页/tool with spaces', 1)).not.toBe(first);
    expect(first).toMatch(/^mcp__[a-z2-7]{12}__[a-z2-7]{12}_search_tool_with_spaces$/u);
    expect(claudeMcpAlias('caller', 'a'.repeat(100))).toHaveLength(64);
  });
});

describe('Claude OAuth MCP request remapping', () => {
  test('aliases every custom declaration and all matching request references', () => {
    const prepared = prepareClaudeTools(customToolRequest, 'caller-secret');
    const searchAlias = aliasFor(prepared.reverse, 'search_web');
    const caseAlias = aliasFor(prepared.reverse, 'Search_Web');
    const body = JSON.stringify(prepared.body);

    expect(searchAlias).toMatch(/^mcp__/u);
    expect(caseAlias).toMatch(/^mcp__/u);
    expect(caseAlias).not.toBe(searchAlias);
    expect(body).toContain('"name":"web_search"');
    expect(body).toContain('"name":"mcp__context7__query-docs"');
    expect(body).not.toContain('"type":"custom"');
    expect(body).not.toContain('"name":"search_web"');
    expect(prepared.reverse[String(searchAlias)]).toBe('search_web');
    expect(prepared.reverse[String(caseAlias)]).toBe('Search_Web');
  });
});

const unmappedHistoryRequest = {
  tools: [{ name: 'Bash', input_schema: { type: 'object' } }],
  messages: [
    { role: 'user', content: 'What is the weather in Paris?' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'one', name: 'Unlisted', input: {} }] },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'one', content: 'sunny, 21C' },
        { type: 'tool_result', tool_use_id: 'two', content: [{ type: 'text', text: 'ok' }] },
      ],
    },
  ],
};

describe('Claude OAuth MCP request remapping leaves the rest of the history alone', () => {
  test('renames only declared tools and keeps every other reference as it was', () => {
    const prepared = prepareClaudeTools(unmappedHistoryRequest, 'caller-secret');
    const body = JSON.stringify(prepared.body);

    expect(body).toContain('"name":"Unlisted"');
    expect(body).toContain('"content":"sunny, 21C"');
    expect(body).toContain('"content":"What is the weather in Paris?"');
    expect(body).not.toContain('"name":"Bash"');
  });

  test('falls back to a generic suffix when the tool name carries no usable characters', () => {
    expect(claudeMcpAlias('caller', '***')).toMatch(/_tool$/u);
  });
});

describe('Claude OAuth MCP response remapping', () => {
  test('restores only names allocated for this request in JSON and SSE', () => {
    const reverse = { mcp__server__tool: 'Search_Web' };
    const restored = restoreClaudeToolBody(
      {
        content: [
          { type: 'tool_use', id: 'one', name: 'mcp__server__tool', input: {} },
          { type: 'tool_use', id: 'two', name: 'Bash', input: {} },
          { type: 'tool_reference', tool_name: 'mcp__server__tool' },
        ],
      },
      reverse,
    );

    expect(restored['content']).toEqual([
      { type: 'tool_use', id: 'one', name: 'Search_Web', input: {} },
      { type: 'tool_use', id: 'two', name: 'Bash', input: {} },
      { type: 'tool_reference', tool_name: 'Search_Web' },
    ]);
    expect(
      restoreClaudeToolSseLine(
        'data: {"type":"content_block_start","content_block":{"type":"tool_use","name":"mcp__server__tool"}}',
        reverse,
      ),
    ).toContain('"name":"Search_Web"');
  });
});

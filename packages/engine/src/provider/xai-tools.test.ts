import { describe, expect, test } from 'vitest';

import { collectXAINamespaceTools, ensureXAINativeSearch, normalizeXAITools } from './xai-tools';

test('promotes additional namespace tools and qualifies child names', () => {
  const body = normalizeXAITools({
    input: [
      {
        type: 'additional_tools',
        role: 'developer',
        tools: [
          {
            type: 'namespace',
            name: 'mcp__exa',
            tools: [{ type: 'function', name: 'web_search_exa', parameters: { type: 'object' } }],
          },
        ],
      },
      { role: 'user', content: 'use Exa' },
    ],
  });

  expect(body['input']).toEqual([{ role: 'user', content: 'use Exa' }]);
  expect(body['tools']).toEqual([
    {
      type: 'function',
      name: 'mcp__exa__web_search_exa',
      parameters: { type: 'object' },
    },
  ]);
});

test('converts custom tools, removes unsupported tools, and cleans web search', () => {
  const body = normalizeXAITools({
    tools: [
      { type: 'tool_search' },
      { type: 'image_generation' },
      { type: 'custom', name: 'apply_patch' },
      { type: 'custom', name: 'lookup' },
      { type: 'function', name: 'ready', parameters: { type: 'object' } },
      { type: 'web_search', external_web_access: true, search_content_types: ['text'] },
    ],
  });

  expect(body['tools']).toEqual([
    {
      type: 'function',
      name: 'lookup',
      parameters: { type: 'object', properties: {} },
    },
    { type: 'function', name: 'ready', parameters: { type: 'object' } },
    { type: 'web_search', search_content_types: ['text'] },
  ]);
});

test('adds object types to root anyOf and oneOf branches', () => {
  const body = normalizeXAITools({
    tools: [
      {
        type: 'function',
        name: 'union_tool',
        parameters: {
          anyOf: [{ properties: { path: { type: 'string' } } }, { type: 'string' }],
          oneOf: [{ required: ['value'], properties: { value: { type: 'number' } } }],
        },
      },
    ],
  });

  expect(body).toHaveProperty('tools.0.parameters.anyOf.0.type', 'object');
  expect(body).toHaveProperty('tools.0.parameters.anyOf.1.type', 'string');
  expect(body).toHaveProperty('tools.0.parameters.oneOf.0.type', 'object');
});

test('qualifies namespaced choices and drops choices for removed tools', () => {
  const qualified = normalizeXAITools({
    tools: [
      {
        type: 'namespace',
        name: 'acme',
        tools: [{ type: 'function', name: 'lookup', parameters: { type: 'object' } }],
      },
    ],
    tool_choice: { type: 'function', namespace: 'acme', name: 'lookup' },
  });
  const orphaned = normalizeXAITools({
    tools: [{ type: 'tool_search' }],
    tool_choice: { type: 'function', name: 'missing' },
    parallel_tool_calls: true,
  });

  expect(qualified).toHaveProperty('tool_choice', { type: 'function', name: 'acme__lookup' });
  expect(orphaned['tool_choice']).toBeUndefined();
});

test('filters allowed_tools choices against the normalized tool list', () => {
  const body = normalizeXAITools({
    tools: [{ type: 'function', name: 'lookup', parameters: { type: 'object' } }],
    tool_choice: {
      type: 'allowed_tools',
      tools: [
        { type: 'function', name: 'lookup' },
        { type: 'function', name: 'missing' },
      ],
    },
  });

  expect(body).toHaveProperty('tool_choice.tools', [{ type: 'function', name: 'lookup' }]);
});

test('leaves an already qualified child name and a namespace ending in a separator', () => {
  const body = normalizeXAITools({
    tools: [
      { type: 'namespace', name: 'acme__', tools: [{ type: 'function', name: 'lookup' }] },
      { type: 'namespace', name: 'zeta', tools: [{ type: 'function', name: 'zeta__probe' }] },
    ],
  });

  expect(body).toHaveProperty('tools.0.name', 'acme__lookup');
  expect(body).toHaveProperty('tools.1.name', 'zeta__probe');
});

test('drops a namespace that declares neither a name nor nested tools', () => {
  const body = normalizeXAITools({ tools: [{ type: 'namespace' }, { type: 'function' }] });

  expect(body['tools']).toEqual([
    { type: 'function', name: '', parameters: { type: 'object', properties: {} } },
  ]);
});

test('passes through entries that are not objects, carry no type, or name an unknown type', () => {
  const body = normalizeXAITools({
    tools: ['plain', { name: 'typeless' }, { type: 'mystery', name: 'future' }],
  });

  expect(body['tools']).toEqual([{ name: 'typeless' }, { type: 'mystery', name: 'future' }]);
});

test('appends promoted additional tools after the declared top-level tools', () => {
  const body = normalizeXAITools({
    tools: [{ type: 'function', name: 'first' }],
    input: [{ type: 'additional_tools', tools: [{ type: 'function', name: 'second' }] }],
  });

  expect(body).toHaveProperty('tools.0.name', 'first');
  expect(body).toHaveProperty('tools.1.name', 'second');
});

test('collects namespace child references and ignores every other entry', () => {
  const refs = collectXAINamespaceTools({
    tools: [
      { type: 'function', name: 'plain' },
      { type: 'namespace', name: 'acme', tools: [{ name: 'lookup' }, 'text', { id: 'anonymous' }] },
      { type: 'namespace', tools: [{ name: '' }] },
      { type: 'namespace', name: 'beta' },
    ],
    input: [
      {
        type: 'additional_tools',
        tools: [{ type: 'namespace', name: 'exa', tools: [{ name: 'search' }] }],
      },
    ],
  });

  expect(refs).toEqual({
    acme__lookup: { namespace: 'acme', name: 'lookup' },
    exa__search: { namespace: 'exa', name: 'search' },
  });
});

test('collects namespace children from a request that carries no input at all', () => {
  const refs = collectXAINamespaceTools({
    tools: [{ type: 'namespace', name: 'acme', tools: [{ name: 'lookup' }] }],
  });

  expect(refs).toEqual({ acme__lookup: { namespace: 'acme', name: 'lookup' } });
});

test('qualifies a namespaced choice that carries no name of its own', () => {
  const body = normalizeXAITools({
    tools: [{ type: 'namespace', name: 'acme', tools: [{ type: 'function', name: '' }] }],
    tool_choice: { type: 'function', namespace: 'acme' },
  });

  expect(body).toHaveProperty('tool_choice', { type: 'function', name: '' });
});

test('drops an allowed_tools choice whose entries match no normalized tool', () => {
  const body = normalizeXAITools({
    tools: [{ type: 'function', name: 'lookup' }],
    tool_choice: { type: 'allowed_tools', tools: ['text', { type: 'function' }] },
  });

  expect(body['tool_choice']).toBeUndefined();
});

test('drops an allowed_tools choice that lists no tools at all', () => {
  const body = normalizeXAITools({
    tools: [{ type: 'function', name: 'lookup' }],
    tool_choice: { type: 'allowed_tools' },
  });

  expect(body['tool_choice']).toBeUndefined();
});

describe('ensureXAINativeSearch', () => {
  test('seeds native search into an allowed_tools choice that lists no tools', () => {
    const body = ensureXAINativeSearch({ tool_choice: { type: 'allowed_tools' } });

    expect(body).toHaveProperty('tools', [{ type: 'x_search' }]);
    expect(body).toHaveProperty('tool_choice.tools', [{ type: 'x_search' }]);
  });

  test('injects x_search into tools and allowed_tools without duplicates', () => {
    const body = ensureXAINativeSearch({
      tools: [{ type: 'function', name: 'lookup' }],
      tool_choice: { type: 'allowed_tools', tools: [{ type: 'function', name: 'lookup' }] },
    });
    const repeated = ensureXAINativeSearch(body);

    expect(body).toHaveProperty('tools.1', { type: 'x_search' });
    expect(body).toHaveProperty('tool_choice.tools.1', { type: 'x_search' });
    expect(repeated).toEqual(body);
  });
});

import { describe, expect, test } from 'vitest';

import { collectXAIClientTools } from './xai-tool-ownership';

function clientToolKey(namespace: string, name: string): string {
  return ['function', namespace, name].join('\0');
}

describe('xAI client tool ownership', () => {
  test('declared function and custom tools are both owned as functions', () => {
    const keys = collectXAIClientTools({
      tools: [
        { type: 'function', name: ' lookup ' },
        { type: 'custom', name: 'apply_patch' },
      ],
    });

    expect(keys).toEqual([clientToolKey('', 'lookup'), clientToolKey('', 'apply_patch')]);
  });

  test('a tool the client cannot own is skipped', () => {
    const keys = collectXAIClientTools({
      tools: ['raw', { type: 'web_search' }, { type: 'function' }, { type: 'function', name: 7 }],
    });

    expect(keys).toEqual([]);
  });

  test('a body carrying no tool lists owns nothing', () => {
    expect(collectXAIClientTools({ tools: 'none', input: 'none' })).toEqual([]);
  });
});

describe('xAI namespaced and attached tools', () => {
  test('a namespace claims its nested tools under the namespace name', () => {
    const keys = collectXAIClientTools({
      tools: [{ type: 'namespace', name: ' files ', tools: [{ type: 'function', name: 'read' }] }],
    });

    expect(keys).toEqual([clientToolKey('files', 'read')]);
  });

  test('a namespace without a name claims its tools under no namespace', () => {
    const keys = collectXAIClientTools({
      tools: [{ type: 'namespace', tools: [{ type: 'custom', name: 'read' }] }],
    });

    expect(keys).toEqual([clientToolKey('', 'read')]);
  });

  test('a namespace holding no tool list claims nothing', () => {
    expect(collectXAIClientTools({ tools: [{ type: 'namespace', name: 'files' }] })).toEqual([]);
  });

  test('tools attached to the input history join the owned set', () => {
    const keys = collectXAIClientTools({
      input: [
        { type: 'message', role: 'user' },
        'raw entry',
        { type: 'additional_tools', tools: [{ type: 'function', name: 'extra' }] },
        { type: 'additional_tools' },
      ],
    });

    expect(keys).toEqual([clientToolKey('', 'extra')]);
  });

  test('a tool named twice is owned once', () => {
    const keys = collectXAIClientTools({
      tools: [{ type: 'function', name: 'lookup' }],
      input: [{ type: 'additional_tools', tools: [{ type: 'custom', name: 'lookup' }] }],
    });

    expect(keys).toEqual([clientToolKey('', 'lookup')]);
  });
});

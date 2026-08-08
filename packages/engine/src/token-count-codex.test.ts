import { describe, expect, test } from 'vitest';

import { countCodexInputTokens } from './token-count';

describe('Codex input counting reads every item shape it is given', () => {
  test('a request with nothing to read counts nothing', () => {
    expect(countCodexInputTokens({}, 'gpt-5')).toBe(0);
  });

  test('an input that is not a list is skipped', () => {
    expect(countCodexInputTokens({ input: 'hello' }, 'gpt-5')).toBe(0);
  });

  test('an item that is not an object is skipped', () => {
    expect(countCodexInputTokens({ input: ['hello', 7] }, 'gpt-5')).toBe(0);
  });

  test('a message is counted through its text parts', () => {
    const input = [{ type: 'message', content: [{ type: 'input_text', text: 'hello world' }] }];

    expect(countCodexInputTokens({ input }, 'gpt-5')).toBeGreaterThan(0);
  });

  test('a message whose content is not a list counts nothing', () => {
    expect(countCodexInputTokens({ input: [{ type: 'message', content: 'hi' }] }, 'gpt-5')).toBe(0);
  });

  test('a message part that is not an object counts nothing', () => {
    const input = [{ type: 'message', content: ['hello'] }];

    expect(countCodexInputTokens({ input }, 'gpt-5')).toBe(0);
  });

  test('a function call is counted with its arguments', () => {
    const input = [{ type: 'function_call', name: 'Bash', arguments: '{"command":"true"}' }];

    expect(countCodexInputTokens({ input }, 'gpt-5')).toBeGreaterThan(0);
  });

  test('a function call output is counted', () => {
    const input = [{ type: 'function_call_output', output: 'the command succeeded' }];

    expect(countCodexInputTokens({ input }, 'gpt-5')).toBeGreaterThan(0);
  });

  test('an item of an unknown type falls back to its text', () => {
    const input = [{ type: 'mystery', text: 'still counted' }];

    expect(countCodexInputTokens({ input }, 'gpt-5')).toBeGreaterThan(0);
  });
});

describe('Codex input counting reads instructions, tools and output format', () => {
  test('instructions are counted', () => {
    expect(countCodexInputTokens({ instructions: 'be brief' }, 'gpt-5')).toBeGreaterThan(0);
  });

  test('tool declarations are counted with their parameters', () => {
    const tools = [{ name: 'Bash', description: 'run a command', parameters: { type: 'object' } }];

    expect(countCodexInputTokens({ tools }, 'gpt-5')).toBeGreaterThan(0);
  });

  test('a tool that is not an object is skipped', () => {
    expect(countCodexInputTokens({ tools: ['Bash'] }, 'gpt-5')).toBe(0);
  });

  test('a tools field that is not a list is skipped', () => {
    expect(countCodexInputTokens({ tools: 'Bash' }, 'gpt-5')).toBe(0);
  });

  test('a structured output format is counted with its schema', () => {
    const text = { format: { name: 'report', schema: { type: 'object' } } };

    expect(countCodexInputTokens({ text }, 'gpt-5')).toBeGreaterThan(0);
  });

  test('a text field that is not an object contributes no format', () => {
    expect(countCodexInputTokens({ text: 'report' }, 'gpt-5')).toBe(0);
  });

  test('a format that is not an object is skipped', () => {
    expect(countCodexInputTokens({ text: { format: 'report' } }, 'gpt-5')).toBe(0);
  });
});

const tokenizers = ['gpt-5', 'GPT-4.1', '  gpt-4o-mini  ', 'o3', 'gpt-3.5-turbo'];

describe('Codex input counting picks a tokenizer from the model name', () => {
  test.each(tokenizers)('%s counts its instructions', (model) => {
    expect(countCodexInputTokens({ instructions: 'be brief' }, model)).toBeGreaterThan(0);
  });
});

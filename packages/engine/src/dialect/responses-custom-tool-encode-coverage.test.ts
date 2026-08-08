import { describe, expect, it } from 'vitest';

import type { HubToolUseBlock } from './hub';

import { customResponsesCall } from './responses-custom-tool-encode';

describe('customResponsesCall writes the input a custom tool call carries', () => {
  it('passes a free-form string through untouched', () => {
    const call = customResponsesCall(toolUse('SELECT 1'));

    expect(call).toEqual({
      type: 'custom_tool_call',
      call_id: 'call_1',
      name: 'run_query',
      input: 'SELECT 1',
    });
  });

  it('serializes a structured input as json', () => {
    const call = customResponsesCall(toolUse({ query: 'SELECT 1', limit: 10 }));

    expect(call).toHaveProperty('input', '{"query":"SELECT 1","limit":10}');
  });

  it('writes an empty json object when the call carries no input', () => {
    const call = customResponsesCall(toolUse(undefined));

    expect(call).toHaveProperty('input', '{}');
  });
});

// Helpers

function toolUse(input: HubToolUseBlock['input']): HubToolUseBlock {
  return { type: 'tool_use', id: 'call_1', name: 'run_query', input, family: 'custom' };
}

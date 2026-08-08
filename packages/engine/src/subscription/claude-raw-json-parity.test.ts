import { describe, expect, it } from 'vitest';

import { normalizeClaudeCchInputRaw } from './claude-cch-raw';
import {
  applyClaudeRawJsonEdits,
  remapClaudeToolNamesRaw,
  type ClaudeRawJsonEdit,
} from './claude-raw-json';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('Claude validated raw JSON edits parity', () => {
  it('TestApplyClaudeRawJSONEditsRejectsInvalidRanges', () => {
    const body = bytes('{"a":"one","b":"two"}');
    const cases: readonly ClaudeRawJsonEdit[][] = [
      [edit(5, 10), edit(8, 12)],
      [edit(-1, 1)],
      [edit(5, 4)],
      [edit(5, body.byteLength + 1)],
    ];

    for (const edits of cases) expect(applyClaudeRawJsonEdits(body, edits)).toBeNull();
  });
});

describe('Claude raw tool-name remapping parity', () => {
  it('TestRemapOAuthToolNamesWithBatchedEditsMatchesLegacyBytes', () => {
    const body = bytes(
      '{\n  "messages" : [{"content":[{"name":"fetch\\u005furl","type":"tool_use"}]}],\n' +
        '  "unknown":{"number":1.2300,"escaped":"a\\/b\\n<>&"},\n' +
        '  "tool_choice":{"name":"fetch\\u005furl","type":"tool"},\n' +
        '  "tools":[{"description":"keep bytes","name":"fetch\\u005furl"}]\n}',
    );
    const result = remapClaudeToolNamesRaw(body, 'differential-caller');
    const output = decoder.decode(result.body);
    const alias = Object.keys(result.reverse)[0];

    expect(alias).toMatch(/^mcp__/u);
    expect(output.match(new RegExp(String(alias), 'gu'))).toHaveLength(3);
    expect(output).toContain('"number":1.2300');
    expect(output).toContain('"escaped":"a\\/b\\n<>&"');
    expect(output).toContain('\n  "messages" :');
  });

  it('TestRemapOAuthToolNamesWithBatchedEditsReturnsOriginalSliceWithoutEdits', () => {
    const body = bytes('{"tools":[{"type":"web_search_20250305","name":"web_search"}]}');
    const result = remapClaudeToolNamesRaw(body, 'no-edits');

    expect(result.body).toBe(body);
    expect(result.reverse).toEqual({});
  });

  it('TestRemapOAuthToolNamesWithOptionsFallsBackForMalformedJSON', () => {
    const body = bytes('{"tools":[{"name":"search_web"}],"messages":[');
    const result = remapClaudeToolNamesRaw(body, 'malformed');

    expect(result.fallback).toBe(true);
    expect(decoder.decode(result.body)).toMatch(/"name":"mcp__/u);
    expect(Object.values(result.reverse)).toEqual(['search_web']);
  });
});

describe('Claude CCH raw normalization parity', () => {
  it('TestNormalizeClaudeCCHInput_PreservesRawJSON', () => {
    const cases: readonly [string, string][] = [
      ['{"model":"claude","keep":1}', '{"model":"","keep":1}'],
      ['{"max_tokens":1,"keep":2}', '{"keep":2}'],
      ['{"keep":1,"fallbacks":[{"model":"x"}],"tail":2}', '{"keep":1,"tail":2}'],
      ['{"keep":1,"fallback_credit_token":"secret"}', '{"keep":1}'],
      ['{"max_tokens":1,"fallbacks":[],"fallback_credit_token":"secret"}', '{}'],
      ['{"keep":1,"max_tokens":1,"fallbacks":[],"tail":2}', '{"keep":1,"tail":2}'],
      ['{"keep":1,"max_tokens":1,"fallbacks":[]}', '{"keep":1,}'],
      ['{"outer":{"model":"x","max_tokens":1,"keep":"y"}}', '{"outer":{"model":"","keep":"y"}}'],
      [
        '{"text":"literal \\"model\\":\\"x\\" and \\"max_tokens\\":1"}',
        '{"text":"literal \\"model\\":\\"x\\" and \\"max_tokens\\":1"}',
      ],
    ];

    for (const [input, expected] of cases) {
      const normalized = normalizeClaudeCchInputRaw(bytes(input));

      expect(normalized === null ? null : decoder.decode(normalized)).toBe(expected);
    }
  });
});

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function edit(start: number, end: number): ClaudeRawJsonEdit {
  return { start, end };
}

import { describe, expect, it } from 'vitest';

import type { AnthropicContentBlock, AnthropicRequest } from './anthropic-wire';
import type { GeminiPart } from './gemini-wire';

import { encodeGeminiClaudeCarrier } from '../provider/gemini-claude-carrier';
import { translateRequestToGemini } from './gemini-bridge';

const first = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const second = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';

describe('Claude raw Gemini carrier restoration', () => {
  it('TestConvertClaudeRequestToAntigravity_ReattachesDetachedGeminiSignature', () => {
    expect(
      textPart(parts([text('visible answer'), rawCarrier(first)]), 'visible answer')
        ?.thoughtSignature,
    ).toBe(first);
  });

  it('TestConvertClaudeRequestToAntigravity_ReattachesLeadingDetachedGeminiSignature', () => {
    expect(
      textPart(parts([rawCarrier(first), text('visible answer')]), 'visible answer')
        ?.thoughtSignature,
    ).toBe(first);
  });

  it('TestConvertClaudeRequestToAntigravity_DropsLegacyRawCarrierFromUserMessage', () => {
    const userParts = parts([rawCarrier(first), text('user text')], 'user');

    expect(userParts).toEqual([{ text: 'user text' }]);
  });

  it('TestConvertClaudeRequestToAntigravity_DistributesConsecutiveTrailingGeminiCarriers', () => {
    const output = parts([text('first'), text('second'), rawCarrier(first), rawCarrier(second)]);

    expect(output[0]).not.toHaveProperty('thoughtSignature');
    expect(output[1]?.thoughtSignature).toBe(first);
    expect(output[2]).toMatchObject({ text: '', thoughtSignature: second });
  });

  it('TestConvertClaudeRequestToAntigravity_PreservesConsecutiveLeadingGeminiCarriers', () => {
    const output = parts([rawCarrier(first), rawCarrier(second), tool('tool-1')]);

    expect(output[0]).toMatchObject({ text: '', thoughtSignature: first });
    expect(functionPart(output)?.thoughtSignature).toBe(second);
  });
});

describe('Claude direct and parallel Gemini tool signatures', () => {
  it('TestConvertClaudeRequestToAntigravity_DirectToolSignatureWinsOverLeadingCarrier', () => {
    const output = parts([rawCarrier(first), tool('tool-1', second)]);

    expect(output[0]).toMatchObject({ text: '', thoughtSignature: first });
    expect(functionPart(output)?.thoughtSignature).toBe(second);
  });

  it('TestConvertClaudeRequestToAntigravity_PreservesCarrierBetweenDirectlySignedParallelTools', () => {
    const output = parts([tool('tool-1', first), rawCarrier(second), tool('tool-2', first)]);

    expect(output.map(partKind)).toEqual(['function', 'carrier', 'function']);
  });

  it('TestConvertClaudeRequestToAntigravity_PreservesGeminiToolSignature', () => {
    expect(functionPart(parts([rawCarrier(first), tool('tool-1')]))?.thoughtSignature).toBe(first);
  });
});

describe('Claude standalone and boundary carriers', () => {
  it('TestConvertClaudeRequestToAntigravity_PreservesCarrierOnlyAssistantMessage', () => {
    expect(parts([rawCarrier(first), rawCarrier(second)])).toEqual([
      { text: '', thought: true, thoughtSignature: first },
      { text: '', thought: true, thoughtSignature: second },
    ]);
  });

  it('TestConvertClaudeRequestToAntigravity_PreservesConsecutiveLeadingGeminiCarriersBeforeText', () => {
    const output = parts([rawCarrier(first), rawCarrier(second), text('visible')]);

    expect(output[0]).toMatchObject({ text: '', thoughtSignature: first });
    expect(output[1]).toMatchObject({ text: 'visible', thoughtSignature: second });
  });

  it('TestConvertClaudeRequestToAntigravity_PreservesTrailingCarrierAfterSignedTool', () => {
    const output = parts([rawCarrier(first), tool('tool-1'), rawCarrier(second)]);

    expect(output.map(partKind)).toEqual(['function', 'carrier']);
    expect(output[1]?.thoughtSignature).toBe(second);
  });

  it('TestConvertClaudeRequestToAntigravity_DetachedToolCarrierTargetsFollowingTool', () => {
    const output = parts([text('preface'), rawCarrier(first), tool('tool-1')]);

    expect(textPart(output, 'preface')).not.toHaveProperty('thoughtSignature');
    expect(functionPart(output)?.thoughtSignature).toBe(first);
  });
});

describe('Claude Gemini thinking signature targeting', () => {
  it('TestConvertClaudeRequestToAntigravity_GeminiThinkingSignatureTargetsFollowingText', () => {
    const output = parts([thinking('hidden thought', first), text('visible answer')]);

    expect(output[0]).not.toHaveProperty('thoughtSignature');
    expect(output[1]?.thoughtSignature).toBe(first);
  });

  it('TestConvertClaudeRequestToAntigravity_LeadingCarrierDoesNotCrossSignedThinking', () => {
    const output = parts([
      marked(first, 'next', 'any'),
      markedThinking('reason', second, 'standalone', 'text'),
      text('answer'),
    ]);

    expect(output[0]).toMatchObject({ text: 'reason', thought: true, thoughtSignature: second });
    expect(output[1]).toMatchObject({ text: '', thoughtSignature: first });
    expect(output[2]).not.toHaveProperty('thoughtSignature');
  });

  it('TestConvertClaudeRequestToAntigravity_DropsMismatchedMarkedNonEmptyCarrier', () => {
    const output = parts([markedThinking('hidden', first, 'next', 'function'), text('visible')]);

    expect(JSON.stringify(output)).not.toContain(first);
    expect(JSON.stringify(output)).not.toContain('cpa-gemini-carrier-v1:');
  });

  it('TestConvertClaudeRequestToAntigravity_GeminiThinkingSignatureTargetsFollowingTool', () => {
    const output = parts([thinking('hidden thought', first), tool('tool-1')]);

    expect(output[0]).not.toHaveProperty('thoughtSignature');
    expect(functionPart(output)?.thoughtSignature).toBe(first);
  });
});

function parts(
  content: AnthropicContentBlock[],
  role: 'assistant' | 'user' = 'assistant',
): GeminiPart[] {
  const request: AnthropicRequest = {
    model: 'gemini-3.6-flash-high',
    max_tokens: 1024,
    messages: [{ role, content }],
  };
  const translated = translateRequestToGemini('anthropic', request);

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));

  return translated.value.contents[0]?.parts ?? [];
}

function text(value: string): AnthropicContentBlock {
  return { type: 'text', text: value };
}

function thinking(value: string, signature: string): AnthropicContentBlock {
  return { type: 'thinking', thinking: value, signature };
}

function rawCarrier(signature: string): AnthropicContentBlock {
  return thinking('', signature);
}

function marked(
  signature: string,
  direction: 'next' | 'previous' | 'standalone',
  target: 'text' | 'function' | 'any',
): AnthropicContentBlock {
  return thinking('', encodeGeminiClaudeCarrier({ signature, direction, target }));
}

function markedThinking(
  value: string,
  signature: string,
  direction: 'next' | 'previous' | 'standalone',
  target: 'text' | 'function' | 'any',
): AnthropicContentBlock {
  return thinking(value, encodeGeminiClaudeCarrier({ signature, direction, target }));
}

function tool(id: string, signature?: string): AnthropicContentBlock {
  return {
    type: 'tool_use',
    id,
    name: 'run_command',
    input: {},
    ...(signature === undefined ? {} : { signature }),
  };
}

function functionPart(output: GeminiPart[]): GeminiPart | undefined {
  return output.find((part) => part.functionCall !== undefined);
}

function textPart(output: GeminiPart[], value: string): GeminiPart | undefined {
  return output.find((part) => part.text === value);
}

function partKind(part: GeminiPart): string {
  if (part.functionCall !== undefined) return 'function';
  if (part.text === '' && part.thoughtSignature !== undefined) return 'carrier';

  return 'text';
}

import { describe, expect, it } from 'vitest';

import type { GeminiPart, GeminiRequest } from './gemini-wire';
import type { ResponsesInputItem } from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { translateRequestToGemini } from './gemini-bridge';

const firstSignature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const secondSignature = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';
const bypass = 'skip_thought_signature_validator';

describe('Gemini Responses raw and ordered function carriers', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_DecodesLegacyRawCarrierForAliasModel', () => {
    const parts = translatedParts([reasoning(firstSignature), call('call-1', 'run')]);

    expect(parts[0]).toMatchObject({
      functionCall: { id: 'call-1', name: 'run' },
      thoughtSignature: firstSignature,
    });
  });

  it('TestReorderOpenAIResponsesDetachedReasoningDoesNotCrossUserMessage', () => {
    const request = translatedRequest([
      message('user', 'next'),
      reasoning(firstSignature),
      call('call-1', 'run_command'),
    ]);

    expect(request.contents.map((content) => content.role)).toEqual(['user', 'model']);
    expect(request.contents[1]?.parts[0]).toMatchObject({
      functionCall: { id: 'call-1' },
      thoughtSignature: firstSignature,
    });
  });

  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesReasoningAndSignatureToFunctionCall', () => {
    const parts = translatedRequest([
      message('user', 'run'),
      reasoning(firstSignature, 'hidden thought'),
      call('call-1', 'run_command', { command: 'true' }),
      output('call-1', 'ok'),
    ]).contents[1]?.parts;

    expect(parts).toEqual([
      { text: 'hidden thought', thought: true },
      {
        functionCall: { id: 'call-1', name: 'run_command', args: { command: 'true' } },
        thoughtSignature: firstSignature,
      },
    ]);
  });
});

describe('Gemini Responses parallel call signatures', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_SyntheticParallelCallsOnlyFirstGetsSentinel', () => {
    const calls = functionParts(
      translatedParts([call('call-1', 'run_command'), call('call-2', 'run_command')]),
    );

    expect(calls[0]?.thoughtSignature).toBe(bypass);
    expect(calls[1]).not.toHaveProperty('thoughtSignature');
  });

  it('TestConvertOpenAIResponsesRequestToGemini_NativeParallelCallsPreserveUnsignedSibling', () => {
    const calls = functionParts(
      translatedParts([
        message('user', 'run twice'),
        reasoning(firstSignature),
        call('call-1', 'run_command'),
        call('call-2', 'run_command'),
      ]),
    );

    expect(calls[0]?.thoughtSignature).toBe(firstSignature);
    expect(calls[1]).not.toHaveProperty('thoughtSignature');
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesMultipleLeadingToolSignatures', () => {
    const parts = translatedParts([
      message('user', 'run twice'),
      reasoning(firstSignature),
      call('call-1', 'run_command'),
      reasoning(secondSignature),
      call('call-2', 'run_command'),
      output('call-1', 'one'),
      output('call-2', 'two'),
    ]);

    expect(functionParts(parts).map((part) => part.thoughtSignature)).toEqual([
      firstSignature,
      secondSignature,
    ]);
    expect(sequence(parts)).toEqual([
      'call:call-1',
      'call:call-2',
      'output:call-1',
      'output:call-2',
    ]);
  });
});

describe('Gemini Responses tool-output ordering', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_GroupsReversedParallelToolOutputs', () => {
    const parts = translatedParts([
      call('call-1', 'run_command'),
      call('call-2', 'run_command'),
      output('call-2', 'two'),
      output('call-1', 'one'),
    ]);

    expect(outputParts(parts).map((part) => part.functionResponse?.id)).toEqual([
      'call-1',
      'call-2',
    ]);
    expect(outputResults(parts)).toEqual(['one', 'two']);
  });
});

describe('Gemini Responses non-contiguous tool-output ordering', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_GroupsNonContiguousParallelToolOutputs', () => {
    const request = translatedRequest([
      call('call-1', 'run_command'),
      call('call-2', 'run_command'),
      output('call-1', 'one'),
      message('user', 'between outputs'),
      output('call-2', 'two'),
    ]);

    expect(contentRoles(request)).toEqual(['model', 'user', 'user', 'user']);
    expect(responseIdAt(request, 1)).toBe('call-1');
    expect(textAt(request, 2)).toBe('between outputs');
    expect(responseIdAt(request, 3)).toBe('call-2');
  });
});

describe('Gemini Responses function output order across model text', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_PreservesFunctionOutputOrderAcrossModelText', () => {
    const parts = translatedParts([
      call('call-1', 'run_command'),
      message('assistant', 'between'),
      call('call-2', 'run_command'),
      output('call-1', 'one'),
      output('call-2', 'two'),
    ]);

    expect(sequence(parts)).toEqual([
      'call:call-1',
      'call:call-2',
      'output:call-1',
      'output:call-2',
    ]);
  });
});

describe('Gemini Responses directional function carriers', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesDirectionalFunctionCarriersWithoutIDs', () => {
    const leading = functionParts(
      translatedParts([
        carrier(firstSignature, 'next', 'function'),
        call('call-1', 'run'),
        output('call-1', 'ok'),
      ]),
    );
    const trailing = functionParts(
      translatedParts([
        call('call-1', 'run'),
        carrier(firstSignature, 'previous', 'function'),
        output('call-1', 'ok'),
      ]),
    );

    expect(leading[0]?.thoughtSignature).toBe(firstSignature);
    expect(trailing[0]?.thoughtSignature).toBe(firstSignature);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_DoesNotBindStandaloneFunctionCarrier', () => {
    const parts = translatedParts([
      carrier(firstSignature, 'standalone', 'function'),
      call('call-1', 'run'),
    ]);

    expect(parts[0]).toMatchObject({ text: '', thought: true, thoughtSignature: firstSignature });
    expect(parts[1]?.thoughtSignature).toBe(bypass);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesReasoningBeforePairedFunctionSignature', () => {
    const parts = translatedParts([
      reasoning(firstSignature, 'first'),
      reasoning(secondSignature, 'second'),
      call('call-1', 'run'),
      output('call-1', 'ok'),
    ]);

    expect(parts.flatMap((part) => part.thoughtSignature ?? [])).toEqual([
      firstSignature,
      secondSignature,
    ]);
  });
});

function translatedRequest(input: ResponsesInputItem[]): GeminiRequest {
  const translated = translateRequestToGemini('responses', { model: 'alias', input });

  if ('refusal' in translated) throw new Error(JSON.stringify(translated.refusal));

  return translated.value;
}

function translatedParts(input: ResponsesInputItem[]): GeminiPart[] {
  return translatedRequest(input).contents.flatMap((content) => content.parts);
}

function reasoning(signature: string, text = ''): ResponsesInputItem {
  return {
    type: 'reasoning',
    summary: text === '' ? [] : [{ type: 'summary_text', text }],
    encrypted_content: signature,
  };
}

function carrier(
  signature: string,
  direction: 'next' | 'previous' | 'standalone',
  target: 'text' | 'function',
): ResponsesInputItem {
  return reasoning(encodeGeminiResponsesCarrier({ signature, direction, target }));
}

function call(id: string, name: string, args: Record<string, unknown> = {}): ResponsesInputItem {
  return { type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) };
}

function output(id: string, result: string): ResponsesInputItem {
  return { type: 'function_call_output', call_id: id, output: result };
}

function message(role: 'user' | 'assistant', text: string): ResponsesInputItem {
  return {
    type: 'message',
    role,
    content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
  };
}

function functionParts(parts: GeminiPart[]): GeminiPart[] {
  return parts.filter((part) => part.functionCall !== undefined);
}

function outputParts(parts: GeminiPart[]): GeminiPart[] {
  return parts.filter((part) => part.functionResponse !== undefined);
}

function outputResults(parts: GeminiPart[]): unknown[] {
  return outputParts(parts).map((part) => part.functionResponse?.response['result']);
}

function contentRoles(request: GeminiRequest): GeminiRequest['contents'][number]['role'][] {
  return request.contents.map((content) => content.role);
}

function responseIdAt(request: GeminiRequest, index: number): string | undefined {
  return request.contents[index]?.parts[0]?.functionResponse?.id;
}

function textAt(request: GeminiRequest, index: number): string | undefined {
  return request.contents[index]?.parts[0]?.text;
}

function sequence(parts: GeminiPart[]): string[] {
  return parts.flatMap((part) => {
    if (part.functionCall?.id !== undefined) return [`call:${part.functionCall.id}`];
    if (part.functionResponse?.id !== undefined) return [`output:${part.functionResponse.id}`];

    return [];
  });
}

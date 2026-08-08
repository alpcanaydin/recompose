import { describe, expect, it } from 'vitest';

import type { GeminiPart, GeminiRequest } from './gemini-wire';
import type { ResponsesInputItem } from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { translateRequestToGemini } from './gemini-bridge';

const first = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const second = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';
const bypass = 'skip_thought_signature_validator';

describe('Gemini Responses detached request signatures', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesTrailingDetachedSignatureToText', () => {
    const parts = modelParts([
      message('user', 'turn one'),
      message('assistant', 'visible answer'),
      carrier(first, 'previous', 'text'),
      message('user', 'turn two'),
    ]);

    expect(parts[0]).toMatchObject({ text: 'visible answer', thoughtSignature: first });
  });

  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesUnmarkedTrailingSignatureToText', () => {
    const parts = modelParts([
      message('user', 'turn one'),
      message('assistant', 'visible answer'),
      reasoning(first),
      message('user', 'turn two'),
    ]);

    expect(parts[0]).toMatchObject({ text: 'visible answer', thoughtSignature: first });
  });

  it('TestConvertOpenAIResponsesRequestToGemini_UnmarkedReasoningBeforeFunctionCallStillPairsCall', () => {
    const parts = modelParts([
      message('user', 'run'),
      message('assistant', 'I will run it.'),
      reasoning(first),
      call('call-1'),
      output('call-1'),
    ]);

    expect(parts[0]).not.toHaveProperty('thoughtSignature');
    expect(parts[1]?.thoughtSignature).toBe(first);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesDetachedSignatureToFunctionCall', () => {
    expect(
      functionParts([call('call-1'), reasoning(first), output('call-1')])[0]?.thoughtSignature,
    ).toBe(first);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesUnmarkedPostCallSignatureWithMatchingOutput', () => {
    expect(
      functionParts([call('call-1'), reasoning(first), output('call-1')])[0]?.thoughtSignature,
    ).toBe(first);
  });
});

describe('Gemini Responses parallel post-call signatures', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesUnmarkedParallelPostCallSignature', () => {
    const calls = functionParts([
      call('call-1'),
      call('call-2'),
      reasoning(first),
      output('call-1'),
      output('call-2'),
    ]);

    expect(calls.map((part) => part.thoughtSignature)).toEqual([bypass, first]);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_ReattachesAlternatingParallelPostCallSignatures', () => {
    const calls = functionParts([
      call('call-1'),
      reasoning(first),
      call('call-2'),
      reasoning(second),
      output('call-1'),
      output('call-2'),
    ]);

    expect(calls.map((part) => part.thoughtSignature)).toEqual([first, second]);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesExtraConsecutivePostCallCarrier', () => {
    const parts = translatedParts([
      call('call-1'),
      reasoning(first),
      reasoning(second),
      output('call-1'),
    ]);

    expect(functionPartsFrom(parts)[0]?.thoughtSignature).toBe(first);
    expect(parts.find((part) => part.text === '')?.thoughtSignature).toBe(second);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_DoesNotPairUnmarkedPostCallSignatureAcrossMismatch', () => {
    expect(
      functionParts([call('call-1'), reasoning(first), output('other-call')])[0]?.thoughtSignature,
    ).toBe(bypass);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_DoesNotPairUnmarkedPostCallSignatureAcrossUserMessage', () => {
    const calls = functionParts([
      call('call-1'),
      reasoning(first),
      message('user', 'boundary'),
      output('call-1'),
    ]);

    expect(calls[0]?.thoughtSignature).toBe(bypass);
  });
});

describe('Gemini Responses reasoning and visible-answer merging', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_MergesReasoningWithAssistantVisibleAnswer', () => {
    const parts = modelParts([
      reasoning(`gemini#${first}`, 'internal reasoning'),
      message('assistant', 'visible answer'),
      message('user', 'continue'),
    ]);

    expect(parts).toEqual([
      { text: 'internal reasoning', thought: true },
      { text: 'visible answer', thoughtSignature: first },
    ]);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_MergesReasoningWithUserRoleOutputText', () => {
    const request = translated([
      reasoning(`gemini#${first}`, 'reasoning summary'),
      outputMessage('user', 'visible from user role'),
    ]);

    expect(request.contents).toHaveLength(1);
    expect(request.contents[0]?.parts[1]?.text).toBe('visible from user role');
  });

  it('TestConvertOpenAIResponsesRequestToGemini_MergesReasoningWithAssistantStringContent', () => {
    const parts = modelParts([
      reasoning(`gemini#${first}`, 'reasoning summary'),
      { type: 'message', role: 'assistant', content: 'string visible answer' },
    ]);

    expect(parts[1]?.text).toBe('string visible answer');
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesWhitespaceWhenMergingReasoning', () => {
    const parts = modelParts([
      reasoning(`gemini#${first}`, 'reasoning summary'),
      message('assistant', '  lead trail  '),
      message('user', 'next'),
    ]);

    expect(parts[1]?.text).toBe('  lead trail  ');
  });

  it('TestConvertOpenAIResponsesRequestToGemini_ReasoningSignatureCompatibility', () => {
    const parts = translatedParts([reasoning(`gemini#${first}`, 'reasoning summary')]);

    expect(parts[0]).toMatchObject({
      text: 'reasoning summary',
      thought: true,
      thoughtSignature: first,
    });
  });
});

function translated(input: ResponsesInputItem[]): GeminiRequest {
  const result = translateRequestToGemini('responses', { model: 'alias', input });

  if ('refusal' in result) throw new Error(JSON.stringify(result.refusal));

  return result.value;
}

function translatedParts(input: ResponsesInputItem[]): GeminiPart[] {
  return translated(input).contents.flatMap((content) => content.parts);
}

function modelParts(input: ResponsesInputItem[]): GeminiPart[] {
  return translated(input).contents.find((content) => content.role === 'model')?.parts ?? [];
}

function functionParts(input: ResponsesInputItem[]): GeminiPart[] {
  return functionPartsFrom(translatedParts(input));
}

function functionPartsFrom(parts: GeminiPart[]): GeminiPart[] {
  return parts.filter((part) => part.functionCall !== undefined);
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

function call(id: string): ResponsesInputItem {
  return { type: 'function_call', call_id: id, name: 'run_command', arguments: '{}' };
}

function output(id: string): ResponsesInputItem {
  return { type: 'function_call_output', call_id: id, output: 'ok' };
}

function message(role: 'user' | 'assistant', text: string): ResponsesInputItem {
  return {
    type: 'message',
    role,
    content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
  };
}

function outputMessage(role: 'user' | 'assistant', text: string): ResponsesInputItem {
  return { type: 'message', role, content: [{ type: 'output_text', text }] };
}
